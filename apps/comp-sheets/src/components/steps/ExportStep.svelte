<script lang="ts">
  import { ProgressBar } from '@wdps/shared-ui';
  import { imagesStore } from '../../lib/state/images.svelte.js';
  import { settingsStore } from '../../lib/state/settings.svelte.js';
  import { progressStore } from '../../lib/state/progress.svelte.js';
  import { computeCaps, isCapError, type PhotographerCount } from '../../lib/fairness/tierCap.js';
  import { buildCompetitionOrder } from '../../lib/order/competitionOrder.js';
  import { processJobs } from '../../lib/processing/workerPool.js';
  import { buildScorerDoc, buildJudgeDoc } from '../../lib/export/docxBuilder.js';
  import { buildScorerPdf, buildJudgePdf } from '../../lib/export/pdfBuilder.js';
  import { streamExportZip } from '../../lib/export/zipBuilder.js';
  import { saveStreamedFile } from '../../lib/export/download.js';
  import { putPayload, compatibleApps, IMAGE_SET_TYPE } from '@wdps/shared-bus';
  import type { ImageRecord, ProcessedImage, OrderedEntry } from '../../lib/types.js';

  let { onBack, onBackToStart }: { onBack: () => void; onBackToStart: () => void } = $props();

  // Only apps that actually declare support for this export's payload
  // type are offered as a destination — and if none do (true today,
  // since comp-sheets is the only app in the suite so far), the whole
  // "send to another app" option is hidden rather than shown with
  // nothing to pick.
  const sendTargets = compatibleApps(IMAGE_SET_TYPE, 'comp-sheets');
  let selectedTargets = $state<Set<string>>(new Set());

  function toggleTarget(id: string, checked: boolean) {
    const next = new Set(selectedTargets);
    if (checked) next.add(id);
    else next.delete(id);
    selectedTargets = next;
  }

  let competitionName = $state('competition');
  let status = $state<'idle' | 'processing' | 'done' | 'error'>('idle');
  let statusMessage = $state('');
  let failedImages = $state<{ id: string; name: string; error: string }[]>([]);

  function includedImages(): ImageRecord[] {
    const map = new Map<string, ImageRecord[]>();
    for (const r of imagesStore.all) {
      const list = map.get(r.photographer) ?? [];
      list.push(r);
      map.set(r.photographer, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.priority - b.priority);

    const counts: PhotographerCount[] = [...map.entries()].map(([photographer, list]) => ({
      photographer,
      submittedCount: list.length
    }));
    const capResult = computeCaps(counts, settingsStore.value.limit);
    if (isCapError(capResult)) return [];

    const included: ImageRecord[] = [];
    for (const [photographer, list] of map) {
      const cap = capResult.caps[photographer] ?? 0;
      included.push(...list.slice(0, cap));
    }
    return included;
  }

  async function runExport() {
    status = 'processing';
    statusMessage = 'processing images…';
    failedImages = [];

    const included = includedImages();
    const order: OrderedEntry[] = buildCompetitionOrder(included, { randomize: settingsStore.value.randomizeOrder });

    progressStore.reset(included.map((r) => r.id));

    const results = await processJobs(
      included.map((r) => ({ id: r.id, file: r.originalFile })),
      (imageId, stage) => progressStore.setStage(imageId, stage),
      (imageId, error) => {
        progressStore.setError(imageId, error);
        const img = included.find((r) => r.id === imageId);
        failedImages = [...failedImages, { id: imageId, name: img?.originalName ?? imageId, error }];
      }
    );

    const processed = new Map<string, ProcessedImage>();
    const thumbnails = new Map<string, Uint8Array>();
    for (const [id, r] of results) {
      processed.set(id, { imageId: id, bytes: r.bytes, thumbnail: r.thumbnail, width: r.width, height: r.height });
      thumbnails.set(id, r.thumbnail);
    }

    const usableOrder = order.filter((e) => processed.has(e.image.id));
    if (usableOrder.length === 0) {
      status = 'error';
      statusMessage = 'no images processed successfully — nothing to export.';
      return;
    }

    statusMessage = 'building score sheets…';
    const docOpts = { competitionName, includeThumbnails: settingsStore.value.includeThumbnails, thumbnails };
    const [scorerDocBlob, judgeDocBlob, scorerPdfBytes, judgePdfBytes] = await Promise.all([
      buildScorerDoc(usableOrder, docOpts),
      buildJudgeDoc(usableOrder, docOpts),
      buildScorerPdf(usableOrder, docOpts),
      buildJudgePdf(usableOrder, docOpts)
    ]);
    const [scorerDocBytes, judgeDocBytes] = await Promise.all([
      scorerDocBlob.arrayBuffer().then((b) => new Uint8Array(b)),
      judgeDocBlob.arrayBuffer().then((b) => new Uint8Array(b))
    ]);

    statusMessage = 'writing zip…';
    progressStore.setZipStage('building');
    const outcome = await saveStreamedFile(`${competitionName}.zip`, 'application/zip', (onChunk) =>
      streamExportZip(
        { entries: usableOrder, processed, scorerDocBytes, judgeDocBytes, scorerPdfBytes, judgePdfBytes, competitionName },
        onChunk
      )
    );
    progressStore.setZipStage('done');

    if (selectedTargets.size > 0) {
      statusMessage = 'sending to wdps bus…';
      await putPayload({
        sourceApp: 'comp-sheets',
        type: IMAGE_SET_TYPE,
        label: `${competitionName} — scorer set (${usableOrder.length} images)`,
        items: usableOrder.map((entry) => ({
          filename: entry.scorerFilename,
          blob: new Blob([processed.get(entry.image.id)!.bytes], { type: 'image/jpeg' }),
          contentType: 'image/jpeg'
        })),
        meta: { competitionName, entryCount: usableOrder.length, targets: [...selectedTargets] }
      });
    }

    status = outcome === 'cancelled' ? 'idle' : 'done';
    statusMessage = outcome === 'cancelled' ? '' : 'export complete.';
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>export<span class="bracket" aria-hidden="true"> ]</span></h2>

  <div class="field">
    <label for="competition-name">competition name</label>
    <input
      id="competition-name"
      type="text"
      value={competitionName}
      oninput={(e) => (competitionName = (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

  {#if sendTargets.length > 0}
    <div class="field">
      <p class="dim">also send the processed images to:</p>
      {#each sendTargets as target}
        <label>
          <input
            type="checkbox"
            checked={selectedTargets.has(target.id)}
            onchange={(e) => toggleTarget(target.id, (e.currentTarget as HTMLInputElement).checked)}
          />
          {target.name}
        </label>
      {/each}
    </div>
  {/if}

  {#if status === 'idle'}
    <button class="btn primary" onclick={runExport}>build &amp; download zip</button>
  {/if}

  {#if status === 'processing'}
    <div class="progress-block">
      <ProgressBar value={progressStore.overallFraction} label={statusMessage} />
      <ul class="image-progress">
        {#each [...progressStore.perImage.entries()] as [id, p]}
          {@const img = imagesStore.all.find((r) => r.id === id)}
          <li class={p.stage === 'error' ? 'danger' : p.stage === 'done' ? 'ok' : 'dim'}>
            [{p.stage === 'done' ? 'x' : p.stage === 'error' ? '!' : ' '}] {img?.originalName ?? id} — {p.stage}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if status === 'done'}
    <p class="ok">{statusMessage}</p>
  {/if}

  {#if status === 'error'}
    <p class="danger">{statusMessage}</p>
  {/if}

  {#if failedImages.length > 0}
    <div class="failures">
      <p class="danger">these images failed and were left out of the export:</p>
      <ul>
        {#each failedImages as f}<li>{f.name} — {f.error}</li>{/each}
      </ul>
    </div>
  {/if}

  <div class="nav-row">
    <button class="btn" onclick={onBack} disabled={status === 'processing'}>← back</button>
    <button class="btn" onclick={onBackToStart} disabled={status === 'processing'}>back to start</button>
  </div>
</section>

<style>
  .field {
    margin-top: 1rem;
  }
  .field input[type='text'] {
    display: block;
    margin-top: 0.3rem;
    width: 30ch;
  }
  .progress-block {
    margin-top: 1.25rem;
  }
  .image-progress {
    list-style: none;
    margin-top: 0.75rem;
    max-height: 16rem;
    overflow-y: auto;
    font-size: 0.9em;
  }
  .failures {
    margin-top: 1rem;
  }
  .nav-row {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
