import { useAuthStore, useSettingStore } from "@/store";
import post, { get } from "@/utils/request";
import { AxiosProgressEvent, GenericAbortSignal } from "axios";

export const ChatAPI = {
  processChat(
    params: {
			roomId: number
			uuid: number
			regenerate?: boolean
			prompt: string
			images?: string[]
			options?: Chat.ConversationRequest
			signal?: GenericAbortSignal
			onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
  ) {
    const settingStore = useSettingStore()
    const authStore = useAuthStore()

    let data: Record<string, any> = {
      roomId: params.roomId,
      uuid: params.uuid,
      regenerate: params.regenerate || false,
      prompt: params.prompt,
      images: params.images,
      options: params.options,
    }

    if (authStore.isChatGPTAPI) {
      data = {
        ...data,
        systemMessage: settingStore.systemMessage,
        temperature: settingStore.temperature,
        top_p: settingStore.top_p,
      }
    }

    return post<Chat.ConversationResponse | Chat.ImageGenerationResponse>({
      url: '/chat/process',
      data,
      signal: params.signal,
      onDownloadProgress: params.onDownloadProgress,
    })
  },

  abortChat(text: string, messageId: string, conversationId: string) {
    return post<any>({
      url: '/chat/abort',
      data: { text, messageId, conversationId },
    })
  },

  getHistoricalResponses(roomId: number, uuid: number, index: number) {
    return get<any>({
      url: '/chat/historical-responses',
      data: { roomId, uuid, index },
    })
  },

  getChatHistories(roomId: number, lastId?: number) {
    return get<any>({
      url: `/chat/histories?roomId=${roomId}&lastId=${lastId}`,
    })
  },

  clearChat(roomId: number) {
    return post<any>({
      url: '/chat/clear',
      data: { roomId },
    })
  },

  clearAllChats() {
    return post<any>({
      url: '/chat/clear-all',
      data: {},
    })
  },

  deleteChat<T = any>(roomId: number, uuid: number, inversion?: boolean) {
    return post<T>({
      url: '/chat/delete',
      data: { roomId, uuid, inversion },
    })
  }
}
