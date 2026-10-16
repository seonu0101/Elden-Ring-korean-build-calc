<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { itemImageUrl } from '@/data/images'
import { itemName } from '@/data/names'
import type { Item } from '@/types'

const props = defineProps<{
  item: Item | null
  /** 빈 칸일 때 보여줄 글자 (예: RH1) */
  placeholder?: string
  /** 지금 고른 칸에 장착 중 */
  equipped?: boolean
  /** 다른 칸에 장착 중 (예: RH2 목록에서 RH1에 든 무기) */
  equippedElsewhere?: boolean
}>()

// 게임처럼 이미지만 보여주고 이름은 아래 상세 정보와 마우스 툴팁으로 보여준다.
// 이미지가 없거나 불러오지 못하면 이름 글자로 대신한다.
const imageFailed = ref(false)
const imageUrl = computed(() => (props.item && !imageFailed.value ? itemImageUrl(props.item) : null))
watch(
  () => props.item?.id,
  () => {
    imageFailed.value = false
  },
)
</script>

<template>
  <div
    class="tile"
    :class="{ 'tile--empty': !item, 'tile--image': imageUrl }"
    :title="item ? itemName(item) : placeholder"
  >
    <img
      v-if="imageUrl"
      class="tile__image"
      :src="imageUrl"
      :alt="item ? itemName(item) : undefined"
      loading="lazy"
      draggable="false"
      data-testid="item-image"
      @error="imageFailed = true"
    />
    <span v-else-if="item" class="tile__name">{{ itemName(item) }}</span>
    <span v-else class="tile__placeholder">{{ placeholder }}</span>
    <span v-if="equipped" class="tile__dot" aria-label="장착 중" />
    <span v-else-if="equippedElsewhere" class="tile__dot tile__dot--other" aria-label="다른 칸에 장착 중" />
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  user-select: none;
  overflow: hidden;
}
.tile--empty {
  border-style: dashed;
  background: transparent;
}
.tile--image {
  padding: 4px;
  background: var(--muted-surface);
}
.tile__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.tile__name {
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tile__placeholder {
  font-size: 11px;
  color: var(--text-faint);
}
.tile__dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--surface);
}
.tile__dot--other {
  background: var(--surface);
  border: 1px solid var(--text-muted);
}
</style>
