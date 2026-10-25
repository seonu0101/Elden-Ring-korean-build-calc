<script setup lang="ts">
// 수집 분석기 탭: Tarnished Ledger(세이브 파일로 수집 현황을 보는 도구)를 띄운다.
// 페이지는 public/ledger/index.html — 기능은 원본 그대로이고 디자인·용어만 Build Calc에 맞췄다
// (scripts/restyle-ledger.mjs). 원본의 스타일·저장소가 앱과 섞이지 않게 iframe 안에서 연다.
// 아이템 이름은 Build Calc 이름표(게임 파일의 공식 이름)를 보내 먼저 쓰게 하고, 이름 언어(한국어/English)도 따라가게 한다.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ALL_ITEMS, BUFFS } from '@/data/items'
import ledgerNames from '@/data/ledger-names-ko.generated.json'
import { koreanName, nameLanguage } from '@/data/names'

const src = `${import.meta.env.BASE_URL}ledger/index.html`
const frame = ref<HTMLIFrameElement | null>(null)

/**
 * { 영어 이름: 한국어 이름 } — 체크리스트의 모든 이름(보스·축복·주문 등, scripts/import-ledger-names.mjs)에
 * 앱의 아이템 이름표(무기·방어구·탈리스만·버프)를 덮어쓴다.
 */
function nameTable(): Record<string, string> {
  const out: Record<string, string> = { ...ledgerNames.names }
  for (const item of [...ALL_ITEMS, ...BUFFS]) {
    const ko = koreanName(item)
    if (ko) out[item.name] = ko
  }
  return out
}

function send(withNames: boolean) {
  frame.value?.contentWindow?.postMessage(
    {
      type: 'build-calc',
      lang: nameLanguage.value,
      ...(withNames ? { names: nameTable(), meta: ledgerNames.meta } : {}),
    },
    location.origin,
  )
}

/** 분석기 페이지가 준비되면 이름표와 언어를 보낸다 */
function onMessage(e: MessageEvent) {
  if (e.origin === location.origin && e.source === frame.value?.contentWindow && e.data?.type === 'build-calc-ledger-ready') send(true)
}
onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
watch(nameLanguage, () => send(false))
</script>

<template>
  <section class="lv" aria-label="수집 분석기">
    <iframe
      ref="frame"
      class="lv__frame"
      :src="src"
      title="Tarnished Ledger — ELDEN RING 수집 분석기"
      data-testid="ledger-frame"
    />
  </section>
</template>

<style scoped>
.lv__frame {
  display: block;
  width: 100%;
  height: calc(100vh - 140px);
  min-height: 560px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
}
@media (max-width: 720px) {
  .lv__frame {
    height: calc(100vh - 160px);
    min-height: 480px;
  }
}
</style>
