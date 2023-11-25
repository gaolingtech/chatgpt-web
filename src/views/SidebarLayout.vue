<script setup lang="ts">
import { SvgIcon } from "@/components/common";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { NLayoutSider, NLayoutContent } from 'naive-ui'

const route = useRoute();

const menus = computed(() => ([
  { label: '聊天', icon: 'majesticons:chat-line', path: '/chat' },
  { label: '知识库', icon: 'majesticons:library-line', path: '/knowledge-base' },
].map(o => ({
  ...o,
  active: route.path.startsWith(o.path)
}))))

</script>

<template>
  <div class="flex h-screen w-screen">
    <NLayoutSider width="128" bordered>
      <div class="p-8 flex flex-col gap-4">
        <div
          v-for="({ icon, label, active, path }, index) in menus"
          :key="index"
          :class="[
            'w-full aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer rounded-md',
            active ? 'text-blue-600 shadow-sm shadow-blue-300' :'hover:shadow-md shadow-gray-400'
          ]"
          @click="$router.push(path)"
        >
          <SvgIcon :icon="icon" class="text-xl" />
          <span>{{ label }}</span>
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent>
      <div class="bg-gray-100 h-full p-4">
        <router-view />
      </div>
    </NLayoutContent>
  </div>
</template>

