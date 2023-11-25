import { get, post } from "@/utils/request";

export const RoomAPI = {
  getChatRooms<T = any>(data?: { knowledgeBaseId: string }) {
    return get<T>({
      url: '/room/list',
      data
    })
  },

  createChatRoom<T = any>(title: string, roomId: number, knowledgeBaseId?: string) {
    return post<T>({
      url: '/room/create',
      data: { title, roomId, knowledgeBaseId },
    })
  },

  renameChatRoom<T = any>(title: string, roomId: number) {
    return post<T>({
      url: '/room/rename',
      data: { title, roomId },
    })
  },

  updateChatRoomPrompt<T = any>(prompt: string, roomId: number) {
    return post<T>({
      url: '/room/set-prompt',
      data: { prompt, roomId },
    })
  },

  updateChatRoomSetting<T = any>(
    data: { roomId: number, usingContext?: boolean, usingImageGeneration?: boolean }
  ) {
    return post<T>({
      url: '/room/setting',
      data
    })
  },

  updateChatRoomModel<T = any>(
    data: { roomId: number, chatModel: string }
  ) {
    return post<T>({
      url: '/room/set-model',
      data
    })
  },

  deleteChatRoom<T = any>(roomId: number) {
    return post<T>({
      url: '/room/delete',
      data: { roomId },
    })
  },
}
