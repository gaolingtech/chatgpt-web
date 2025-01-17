<script setup lang='ts'>
import { ChatAPI, fetchUploadImage, KnowledgeBaseAPI } from '@/api'
import { HoverButton, SvgIcon } from '@/components/common'
import type { ChatModel } from '@/components/common/Setting/model'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import IconPrompt from '@/icons/Prompt.vue'
import { t } from '@/locales'
import { useAuthStore, useChatStore, usePromptStore, useUserStore } from '@/store'
import { debounce } from '@/utils/functions/debounce'
import { AxiosProgressEvent } from "axios";
import html2canvas from 'html2canvas'
import type { MessageReactive } from 'naive-ui'
import { NAutoComplete, NButton, NImage, NInput, NSelect, NSpace, NSpin, NUpload, useDialog, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from './components'
import HeaderComponent from './components/Header/index.vue'
import { useChat } from './hooks/useChat'
import { useScroll } from './hooks/useScroll'

const Prompt = defineAsyncComponent(() => import('@/components/common/Setting/Prompt.vue'))

let controller = new AbortController()
let lastChatInfo : any = {}

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const ms = useMessage()
const route = useRoute()
const dialog = useDialog()
const authStore = useAuthStore()
const userStore = useUserStore()
const chatStore = useChatStore()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatPartial, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom, scrollTo } = useScroll()

const { uuid } = route.params as { uuid: string }

const showPrompt = ref(false)
const prompt = ref<string>('')
const images = ref<string[]>([])
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)
const firstLoading = ref<boolean>(false)
const nowSelectChatModel = ref<ChatModel | null>(null)

const chatMessages = computed(() => chatStore.getChatByUuid(+uuid))
const activeChatRoom = computed(() => chatStore.getActiveChatRoom)

const usingContext = computed(() => activeChatRoom?.value?.usingContext ?? true)
const usingImageGeneration = computed(() => activeChatRoom?.value?.usingImageGeneration || false)

const conversationList = computed(() => chatMessages.value.filter(item => (!item.inversion && !!item.conversationOptions)))
const currentChatModel = computed(() => nowSelectChatModel.value ?? activeChatRoom.value?.chatModel)

const isKnowledgeBaseChat = computed(() => !!chatStore.getActiveChatRoom?.knowledgeBaseId)

let loadingMsg: MessageReactive
let allMsg: MessageReactive
let prevScrollTop: number

const { promptList: promptTemplate } = storeToRefs<any>(usePromptStore())

// 未知原因刷新页面，loading 状态不会重置，手动重置
chatMessages.value.forEach((item, index) => {
  if (item.loading) {
    updateChatPartial(+uuid, index, { loading: false })
  }
})

async function requestChatCompletion(chatUuid: number, message: string, options: Chat.ConversationRequest, message_index_to_regenerate: undefined | number) {
  let lastText = ''

  const index = message_index_to_regenerate ?? chatMessages.value.length - 1

  const handlePartialResponse = ({ event: { target: { responseText } } }: AxiosProgressEvent) => {
    // Always process the final line
    const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
    let chunk = responseText
    if (lastIndex !== -1) {
      chunk = responseText.substring(lastIndex)
    }
    try {
      const data = JSON.parse(chunk)
      lastChatInfo = data

      const usage = (data.detail && data.detail.usage)
        ? {
          completion_tokens: data.detail.usage.completion_tokens || null,
          prompt_tokens: data.detail.usage.prompt_tokens || null,
          total_tokens: data.detail.usage.total_tokens || null,
          estimated: data.detail.usage.estimated || null,
        }
        : undefined

      updateChatPartial(
        +uuid,
        index,
        {
          text: lastText + (data.text ?? ''),
        },
      )

      if (openLongReply && data.detail && data.detail.choices.length > 0 && data.detail.choices[0].finish_reason === 'length') {
        options.parentMessageId = data.id
        lastText = data.text
        message = ''
        return fetchChatAPIOnce()
      }

      scrollToBottomIfAtBottom()
    } catch (error) {
      //
    }
  }

  const fetchChatAPIOnce = async () => {
    await ChatAPI.processChat({
      options,
      roomId: +uuid,
      uuid: chatUuid,
      prompt: message,
      images: images.value,
      signal: controller.signal,
      regenerate: message_index_to_regenerate !== undefined,
      onDownloadProgress: handlePartialResponse,
    })
    updateChatPartial(+uuid, index, { loading: false })
  }

  await fetchChatAPIOnce()
}

async function requestImageGeneration(chatUuid: number, message: string, options: Chat.ConversationRequest, message_index_to_regenerate: undefined | number) {
  const response = await ChatAPI.processChat({
    options,
    roomId: +uuid,
    uuid: chatUuid,
    prompt: message,
    images: images.value,
    signal: controller.signal,
    regenerate: message_index_to_regenerate !== undefined,
  })

  const imageGenerationResponse: Chat.ImageGenerationResponse = response.data as Chat.ImageGenerationResponse

  lastChatInfo = imageGenerationResponse

  const index = message_index_to_regenerate || chatMessages.value.length - 1

  updateChatPartial(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      images: imageGenerationResponse.data.map(o => o.url),
      inversion: false,
      error: false,
      loading: false,
      conversationOptions: {
        conversationId: imageGenerationResponse.conversationId,
        parentMessageId: undefined
      },
      requestOptions: {
        prompt: message,
        options: { ...options }
      },
      usage: undefined,
    })

  return scrollToBottomIfAtBottom()
}

async function requestKnowledgeBase(roomId: string, prompt: string) {
  const { text } = (await KnowledgeBaseAPI.askToKnowledgeBase(roomId, prompt)).data
  const index = chatMessages.value.length - 1

  updateChatPartial(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text,
      inversion: false,
      error: false,
      loading: false,
    })

  return scrollToBottomIfAtBottom()
}

async function handleSubmit() {
  if (loading.value) {
    return
  }

  controller = new AbortController()

  let message = prompt.value
  let options: Chat.ConversationRequest = {}

  if (!message || message.trim() === '') {
    return
  }

  const chatUuid = Date.now()
  addChat(
    +uuid,
    {
      uuid: chatUuid,
      dateTime: new Date().toLocaleString(),
      text: message,
      images: images.value,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  await scrollToBottom()

  loading.value = true
  prompt.value = ''

  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value) {
    options = { ...lastContext }
  }

  addChat(
    +uuid,
    {
      uuid: chatUuid,
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  await scrollToBottom()

  try {
    if (chatStore.getActiveChatRoom?.knowledgeBaseId) {
      return await requestKnowledgeBase(uuid, message)
    }

    if (usingImageGeneration.value) {
      return await requestImageGeneration(chatUuid, message, options, undefined)
    }

    return await requestChatCompletion(chatUuid, message, options, undefined)
  } catch (error: any) {
    const errorMessage = error?.message ?? error ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatPartial(
        +uuid,
        chatMessages.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, chatMessages.value.length - 1)

    if (currentChat?.text && currentChat.text !== '') {
      updateChatPartial(
        +uuid,
        chatMessages.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      chatMessages.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  } finally {
    loading.value = false
    images.value = []
  }
}

async function handleRegenerate(index: number) {
  if (loading.value) {
    return
  }

  controller = new AbortController()

  const { requestOptions } = chatMessages.value[index]
  const responseCount = (chatMessages.value[index].responseCount || 1) + 1

  // let message = prompt.value
  let message = requestOptions?.prompt ?? ''
  let options: Chat.ConversationRequest = {}

  if (requestOptions.options) {
    options = { ...requestOptions.options }
  }

  loading.value = true
  const chatUuid = chatMessages.value[index].uuid!

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      responseCount,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    if (usingImageGeneration.value) {
      return requestImageGeneration(chatUuid, message, options, index)
    } else {
      return requestChatCompletion(chatUuid, message, options, index)
    }
  } catch (error: any) {
    if (error.message === 'canceled') {
      updateChatPartial(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        responseCount,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  } finally {
    loading.value = false
  }
}

async function onResponseHistory(index: number, historyIndex: number) {
  updateChatPartial(
    +uuid,
    index,
    {
      loading: true,
      text: '',
      images: []
    },
  )

  const chat = (await ChatAPI.getHistoricalResponses(+uuid, chatMessages.value[index].uuid || Date.now(), historyIndex)).data

  updateChat(
    +uuid,
    index,
    {
      ...chat,
      inversion: false,
      loading: false,
    },
  )
}

function handleExport() {
  if (loading.value) {
    return
  }

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined') {
          tempLink.setAttribute('target', '_blank')
        }

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      } catch (error: any) {
        ms.error(t('chat.exportFailed'))
      } finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value) {
    return
  }

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value) {
    return
  }

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  } else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

async function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
    await ChatAPI.abortChat(lastChatInfo.text, lastChatInfo.id, lastChatInfo.conversationId)
  }
}

async function loadMoreMessage(event: any) {
  const chatIndex = chatStore.chat.findIndex(d => d.uuid === +uuid)
  if (chatIndex <= -1 || chatStore.chat[chatIndex].data.length <= 0) {
    return
  }

  const scrollPosition = event.target.scrollHeight - event.target.scrollTop

  const lastId = chatStore.chat[chatIndex].data[0].uuid
  await chatStore.syncChat({ uuid: +uuid } as Chat.ChatRoom, lastId, () => {
    loadingMsg && loadingMsg.destroy()
    nextTick(() => scrollTo(event.target.scrollHeight - scrollPosition))
  }, () => {
    loadingMsg = ms.loading(
      '加载中...', {
        duration: 0,
      },
    )
  }, () => {
    allMsg && allMsg.destroy()
    allMsg = ms.warning('没有更多了', {
      duration: 1000,
    })
  })
}

const handleLoadMoreMessage = debounce(loadMoreMessage, 300)
const handleSyncChat = debounce(() => {
  // 直接刷 极小概率不请求
  chatStore.syncChat({ uuid: Number(uuid) } as Chat.ChatRoom, undefined, () => {
    firstLoading.value = false
    const scrollRef = document.querySelector('#scrollRef')
    if (scrollRef) {
      nextTick(() => scrollRef.scrollTop = scrollRef.scrollHeight)
    }
    if (inputRef.value && !isMobile.value) {
      inputRef.value?.focus()
    }
  })
}, 200)

async function handleScroll(event: any) {
  const scrollTop = event.target.scrollTop
  if (scrollTop < 50 && (scrollTop < prevScrollTop || prevScrollTop === undefined)) {
    handleLoadMoreMessage(event)
  }
  prevScrollTop = scrollTop
}

async function handleToggleUsingContext() {
  if (!activeChatRoom.value) {
    return
  }

  activeChatRoom.value.usingContext = !activeChatRoom.value.usingContext
  chatStore.setRoomSetting(
    +uuid,
    activeChatRoom.value.usingContext,
    undefined
  )
  if (activeChatRoom.value.usingContext) {
    ms.success(t('chat.turnOnContext'))
  } else {
    ms.warning(t('chat.turnOffContext'))
  }
}

async function handleToggleUsingImageGeneration() {
  if (!activeChatRoom.value) {
    return
  }

  activeChatRoom.value.usingImageGeneration = !activeChatRoom.value.usingImageGeneration
  chatStore.setRoomSetting(
    +uuid,
    undefined,
    activeChatRoom.value?.usingImageGeneration,
  )

  if (activeChatRoom.value?.usingImageGeneration) {
    ms.success(t('chat.turnOnImageGeneration'))
  } else {
    ms.warning(t('chat.turnOffImageGeneration'))
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  } else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label) {
      return [i.key]
    }
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value) {
    return t('chat.placeholderMobile')
  }
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value) {
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  }
  return classes
})

async function handleChatModelChange(chatModel: ChatModel) {
  nowSelectChatModel.value = chatModel

  return chatStore.updateChatModel(Number(uuid), chatModel);
}

const handleUpload = async (event: any) => {
  const file = event.target.files![0]
  return fetchUploadImage(file)
    .then(r => images.value.push(r.data))
}

onMounted(() => {
  firstLoading.value = true
  handleSyncChat()

  if (authStore.token) {
    const chatModels = authStore.session?.chatModels
    if (chatModels && chatModels.filter(d => d.value === userStore.userInfo.config.chatModel).length <= 0) {
      ms.error('你选择的模型已不存在，请重新选择 | The selected model not exists, please choose again.', { duration: 7000 })
    }
  }
})

watch(() => chatStore.active, () => {
  handleSyncChat()
})

onUnmounted(() => {
  if (loading.value) {
    controller.abort()
  }
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent
      v-if="isMobile"
      :using-context="usingContext"
      :show-prompt="showPrompt"
      @export="handleExport"
      @toggle-using-context="handleToggleUsingContext"
      @toggle-show-prompt="showPrompt = true"
    />
    <main class="flex-1 overflow-hidden">
      <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto" @scroll="handleScroll">
        <div
          id="image-wrapper"
          class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <NSpin :show="firstLoading">
            <template v-if="!chatMessages.length">
              <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
                <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
                <span>Aha~</span>
              </div>
            </template>
            <template v-else>
              <div>
                <Message
                  v-for="(item, index) of chatMessages"
                  :key="index"
                  :date-time="item.dateTime"
                  :text="item.text"
                  :images="item.images"
                  :inversion="item.inversion"
                  :response-count="item.responseCount"
                  :usage="item && item.usage || undefined"
                  :error="item.error"
                  :loading="item.loading"
                  :disable-regenerate="isKnowledgeBaseChat"
                  @regenerate="handleRegenerate(index)"
                  @delete="handleDelete(index)"
                  @response-history="(ev) => onResponseHistory(index, ev)"
                />
                <div class="sticky bottom-0 left-0 flex justify-center">
                  <NButton v-if="loading" type="warning" @click="handleStop">
                    <template #icon>
                      <SvgIcon icon="ri:stop-circle-line" />
                    </template>
                    Stop Responding
                  </NButton>
                </div>
              </div>
            </template>
          </NSpin>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full max-w-screen-xl m-auto">
        <NSpace vertical>
          <div class="flex items-center space-x-2">
            <HoverButton @click="handleClear">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <SvgIcon icon="ri:delete-bin-line" />
              </span>
            </HoverButton>
            <HoverButton v-if="!isMobile" @click="handleExport">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <SvgIcon icon="ri:download-2-line" />
              </span>
            </HoverButton>
            <HoverButton v-if="!isMobile" @click="showPrompt = true">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <IconPrompt class="w-[20px] m-auto" />
              </span>
            </HoverButton>
            <HoverButton
              v-if="!isMobile"
              :tooltip="usingContext ? '点击停止包含上下文' : '点击开启包含上下文'"
              :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }"
              @click="handleToggleUsingContext"
            >
              <span class="text-xl">
                <SvgIcon icon="ri:chat-history-line" />
              </span>
              <span style="margin-left:.25em">{{ usingContext ? '包含上下文' : '不含上下文' }}</span>
            </HoverButton>

            <HoverButton
              v-if="!isMobile"
              :tooltip="usingImageGeneration ? '点击停止使用图片生成' : '点击开启使用图片生成'"
              :class="{ 'text-[#4b9e5f]': usingImageGeneration, 'text-[#a8071a]': !usingImageGeneration }"
              @click="handleToggleUsingImageGeneration"
            >
              <span class="text-xl">
                <SvgIcon icon="ri:chat-history-line" />
              </span>
              <span style="margin-left:.25em">{{ usingImageGeneration ? '使用图片生成' : '不使用图片生成' }}</span>
            </HoverButton>

            <NSelect
              style="width: 250px"
              :value="currentChatModel"
              :options="authStore.session?.chatModels"
              :disabled="!!authStore.session?.auth && !authStore.token"
              @update-value="(val) => handleChatModelChange(val)"
            />
          </div>
          <div v-if="images && images.length" class="p-4 flex gap-4">
            <div v-for="image in images" :key="image" class="flex items-center justify-center w-24 h-24 border border-dashed border-white overflow-hidden">
              <NImage :src="image" object-fit="contain" />
            </div>
          </div>

          <div class="flex items-center justify-between space-x-2">
            <div
              v-if="currentChatModel === 'gpt-4-vision-preview'"
              class="relative p-4"
            >
              <NUpload
                :file-list="[]"
                :headers="{
                  'naive-info': 'hello!',
                }"
                :data="{
                  'naive-data': 'cool! naive!',
                }"
                @input="handleUpload"
              >
                <NButton dashed>
                  <template #icon>
                    <span class="dark:text-black">
                      <SvgIcon icon="ri:links-fill" />
                    </span>
                  </template>
                </NButton>
              </NUpload>
            </div>
            <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
              <template #default="{ handleInput, handleBlur, handleFocus }">
                <NInput
                  ref="inputRef"
                  v-model:value="prompt"
                  :disabled="!!authStore.session?.auth && !authStore.token"
                  type="textarea"
                  :placeholder="placeholder"
                  :autosize="{ minRows: isMobile ? 1 : 4, maxRows: isMobile ? 4 : 8 }"
                  @input="handleInput"
                  @focus="handleFocus"
                  @blur="handleBlur"
                  @keypress="handleEnter"
                />
              </template>
            </NAutoComplete>
            <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
              <template #icon>
                <span class="dark:text-black">
                  <SvgIcon icon="ri:send-plane-fill" />
                </span>
              </template>
            </NButton>
          </div>
        </NSpace>
      </div>
    </footer>
    <Prompt v-if="showPrompt" v-model:roomId="uuid" v-model:visible="showPrompt" />
  </div>
</template>
