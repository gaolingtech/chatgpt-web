<template>
  <div v-if="!store.currentKnowledgeBase">
    <n-skeleton height="500px" />
  </div>

  <div v-else class="w-full h-full p-4 bg-white shadow shadow-gray-300">
    <div class="flex gap-2 mb-2 items-center">
      <SvgIcon icon="ep:back" class="text-gray-500 text-3xl mb-2 cursor-pointer" @click="router.back()" />

      <div class="w-[1px] h-4 bg-gray-400" />

      <SvgIcon icon="majesticons:library-line" class="text-2xl  text-blue-500" />
      <span class="text-3xl  text-blue-500">
        {{ store.currentKnowledgeBase!.name }}
      </span>
    </div>

    <div class="text-gray-500 overflow-hidden overflow-ellipsis flex-1 mb-4">
      {{ store.currentKnowledgeBase!.introduction || '该知识库暂无介绍' }}
    </div>

    <div class="w-96 border p-4">
      <NScrollbar class="px-4">
        <div class="flex flex-col justify-start gap-2 text-sm">
          <div v-for="(item, index) of store.currentKnowLedgeBaseChatRooms" :key="index">
            <a
              class="relative flex items-center gap-3 px-3 py-3 break-all border rounded-md cursor-pointer hover:bg-neutral-100 group dark:border-neutral-800 dark:hover:bg-[#24272e]"
              @click="chatStore.setActive(item.uuid)"
            >
              <span>
                <SvgIcon icon="ri:message-3-line" />
              </span>
              <div class="relative flex-1 overflow-hidden break-all text-ellipsis whitespace-nowrap">
                <span>{{ item.title }}</span>
              </div>
            </a>
          </div>
          <n-button type="success" @click="createRoomForKnowledgeBase">
            开启新对话
          </n-button>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RoomAPI } from "@/api";
import { SvgIcon } from "@/components/common/SvgIcon/index";
import { useChatStore } from "@/store";
import { useKnowledgeBaseStore } from "@/store/modules/knowledge-base";
import { NScrollbar, useMessage } from 'naive-ui'
import { onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const store = useKnowledgeBaseStore()
const chatStore = useChatStore()

const createRoomForKnowledgeBase = async () => {
  const { currentKnowledgeBase } = store
  if (!currentKnowledgeBase) {
    return
  }

  const roomId = Date.now()
  await RoomAPI.createChatRoom(`知识库: ${currentKnowledgeBase.name}`, roomId, currentKnowledgeBase._id)

  await chatStore.setActive(roomId)
}

onMounted(() => {
  const { id } = route.params
  if (!id) {
    message.error('知识库不存在')
    return router.back()
  }

  return store.viewKnowledgeBase(id as string)
})

onUnmounted(() => {
  store.clearState()
})
</script>

