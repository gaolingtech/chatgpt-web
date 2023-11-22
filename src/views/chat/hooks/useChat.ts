import { useChatStore } from '@/store'

export function useChat() {
  const chatStore = useChatStore()

  const getChatByUuidAndIndex = (uuid: number, index: number) => {
    return chatStore.getChatByUuidAndIndex(uuid, index)
  }

  const addChat = (uuid: number, chat: Chat.ChatMessage) => {
    return chatStore.addChatByUuid(uuid, chat)
  }

  const updateChat = (uuid: number, index: number, chat: Chat.ChatMessage) => {
    chatStore.updateChatByUuid(uuid, index, chat)
  }

  const updateChatPartial = (uuid: number, index: number, chat: Partial<Chat.ChatMessage>) => {
    chatStore.updateChatSomeByUuid(uuid, index, chat)
  }

  return {
    addChat,
    updateChat,
    updateChatPartial,
    getChatByUuidAndIndex,
  }
}
