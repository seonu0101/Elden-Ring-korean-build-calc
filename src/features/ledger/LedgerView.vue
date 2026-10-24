<script setup lang="ts">
// 수집 분석기 탭: Tarnished Ledger(세이브 파일로 수집 현황을 보는 도구)를 그대로 띄운다.
// 페이지는 public/ledger/index.html — 기능(스크립트)은 원본 그대로이고 디자인만 Build Calc에 맞췄다
// (scripts/restyle-ledger.mjs). 원본의 스타일·저장소가 앱과 섞이지 않게 iframe 안에서 연다.
const src = `${import.meta.env.BASE_URL}ledger/index.html`
</script>

<template>
  <section class="lv" aria-label="수집 분석기">
    <iframe class="lv__frame" :src="src" title="Tarnished Ledger — ELDEN RING 수집 분석기" data-testid="ledger-frame" />
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
