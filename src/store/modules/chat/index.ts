import { ChatAPI, RoomAPI } from '@/api'
import { router } from '@/router'
import { defineStore } from 'pinia'
import { getLocalState, setLocalState } from './helper'

export const useChatStore = defineStore('chat-store', {
  state: (): Chat.ChatState => {
    return getLocalState();
  },

  getters: {
    getActiveChatRoom(state: Chat.ChatState): Chat.ChatRoom | null {
      const index = state.chatRooms.findIndex(item => item.uuid === state.active)
      if (index !== -1) {
        return state.chatRooms[index]
      }
      return null
    },

    getChatByUuid(state: Chat.ChatState) {
      return (uuid?: number) => {
        if (uuid) {
          return state.chat.find(item => item.uuid === uuid)?.data ?? []
        }
        return state.chat.find(item => item.uuid === state.active)?.data ?? []
      }
    },
  },

  actions: {
    async syncHistory(callback: () => void) {
      const rooms = (await RoomAPI.getChatRooms()).data
      let uuid = this.active
      this.chatRooms = []
      this.chat = []
      if (rooms.findIndex((item: { uuid: number | null }) => item.uuid === uuid) <= -1) {
        uuid = null
      }

      for (const room of rooms) {
        this.chatRooms.unshift(room)
        if (uuid === null) {
          uuid = room.uuid
        }
        this.chat.unshift({
          uuid: room.uuid,
          data: []
        })
      }
      if (uuid === null) {
        await this.addHistory({
          title: 'New Chat',
          uuid: Date.now(),
          isEdit: false,
          usingContext: true,
          usingImageGeneration: false
        })
      } else {
        this.active = uuid
        this.reloadRoute(uuid)
      }
      callback && callback()
    },

    async syncChat(
      h: Chat.ChatRoom,
      lastId?: number,
      callback?: () => void,
      callbackForStartRequest?: () => void,
      callbackForEmptyMessage?: () => void
    ) {
      if (!h.uuid && callback) {
        callback()
        return
      }
      const history = this.chatRooms.filter(item => item.uuid === h.uuid)[0]

      if (history === undefined || history.loading || history.all) {
        if (lastId === undefined && callback) {
          // 加载更多不回调 避免加载概率消失
          callback()
        }
        if (history?.all) {
          callbackForEmptyMessage && callbackForEmptyMessage()
        }
        return
      }
      try {
        history.loading = true
        const chatIndex = this.chat.findIndex(item => item.uuid === h.uuid)
        if (chatIndex <= -1 || this.chat[chatIndex].data.length <= 0 || lastId !== undefined) {
          callbackForStartRequest?.()

          const chatData = (await ChatAPI.getChatHistories(h.uuid, lastId)).data
          if (chatData.length <= 0) {
            history.all = true
          }

          if (chatIndex <= -1) {
            this.chat.unshift({
              uuid: h.uuid,
              data: chatData
            })
          } else {
            this.chat[chatIndex].data.unshift(...chatData)
          }
        }
      } finally {
        history.loading = false
        if (history.all) {
          callbackForEmptyMessage && callbackForEmptyMessage()
        }
        this.recordState()
        callback?.()
      }
    },

    async setRoomSetting(roomId: number, usingContext?: boolean, usingImageGeneration?: boolean) {
      const room = this.$state.chatRooms.find(o => o.uuid === roomId)
      if (room) {
        if (usingImageGeneration) {
          room.usingImageGeneration = usingImageGeneration
        }
        if (usingContext) {
          room.usingContext= usingContext
        }
      }

      await RoomAPI.updateChatRoomSetting({
        usingContext,
        usingImageGeneration,
        roomId
      })
      this.recordState()
    },

    async addHistory(history: Chat.ChatRoom, chatData: Chat.ChatMessage[] = []) {
      await RoomAPI.createChatRoom(history.title, history.uuid)
      this.chatRooms.unshift(history)
      this.chat.unshift({
        uuid: history.uuid,
        data: chatData
      })
      this.active = history.uuid
      return this.reloadRoute(history.uuid)
    },

    updateHistory(uuid: number, edit: Partial<Chat.ChatRoom>) {
      const index = this.chatRooms.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.chatRooms[index] = { ...this.chatRooms[index], ...edit }
        this.recordState()
        if (!edit.isEdit) {
          return RoomAPI.renameChatRoom(this.chatRooms[index].title, this.chatRooms[index].uuid)
        }
      }
    },

    async deleteHistory(index: number) {
      await RoomAPI.deleteChatRoom(this.chatRooms[index].uuid)
      this.chatRooms.splice(index, 1)
      this.chat.splice(index, 1)

      if (this.chatRooms.length === 0) {
        await this.addHistory({
          title: 'New Chat',
          uuid: Date.now(),
          isEdit: false,
          usingContext: true,
          usingImageGeneration: false
        })
        return
      }

      if (index > 0 && index <= this.chatRooms.length) {
        const uuid = this.chatRooms[index - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
        return
      }

      if (index === 0) {
        if (this.chatRooms.length > 0) {
          const uuid = this.chatRooms[0].uuid
          this.active = uuid
          this.reloadRoute(uuid)
        }
      }

      if (index > this.chatRooms.length) {
        const uuid = this.chatRooms[this.chatRooms.length - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
      }
    },

    async setActive(uuid: number) {
      this.active = uuid
      return await this.reloadRoute(uuid)
    },

    getChatByUuidAndIndex(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          return this.chat[0].data[index]
        }
        return null
      }
      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        return this.chat[chatIndex].data[index]
      }
      return null
    },

    async addChatByUuid(uuid: number, chat: Chat.ChatMessage) {
      if (!uuid || uuid === 0) {
        if (this.chatRooms.length === 0) {
          const uuid = Date.now()
          await RoomAPI.createChatRoom(chat.text, uuid)

          this.chatRooms.push({
            uuid,
            title: chat.text,
            isEdit: false,
            usingContext: true,
            usingImageGeneration: false
          })
          this.chat.push({
            uuid,
            data: [chat]
          })
          this.active = uuid
          this.recordState()
        } else {
          this.chat[0].data.push(chat)
          if (this.chatRooms[0].title === 'New Chat') {
            this.chatRooms[0].title = chat.text
            await RoomAPI.renameChatRoom(chat.text, this.chatRooms[0].uuid)
          }
          this.recordState()
        }
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.chat[index].data.push(chat)
        if (this.chatRooms[index].title === 'New Chat') {
          this.chatRooms[index].title = chat.text
          await RoomAPI.renameChatRoom(chat.text, this.chatRooms[index].uuid)
        }
        this.recordState()
      }
    },

    updateChatByUuid(uuid: number, index: number, chat: Chat.ChatMessage) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          chat.uuid = this.chat[0].data[index].uuid
          this.chat[0].data[index] = chat
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        chat.uuid = this.chat[chatIndex].data[index].uuid
        this.chat[chatIndex].data[index] = chat
        this.recordState()
      }
    },

    updateChatSomeByUuid(uuid: number, index: number, chat: Partial<Chat.ChatMessage>) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          chat.uuid = this.chat[0].data[index].uuid
          this.chat[0].data[index] = { ...this.chat[0].data[index], ...chat }
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        chat.uuid = this.chat[chatIndex].data[index].uuid
        this.chat[chatIndex].data[index] = { ...this.chat[chatIndex].data[index], ...chat }
        this.recordState()
      }
    },

    async deleteChatByUuid(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          await ChatAPI.deleteChat(uuid, this.chat[0].data[index].uuid || 0, this.chat[0].data[index].inversion)
          this.chat[0].data.splice(index, 1)
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        await ChatAPI.deleteChat(uuid, this.chat[chatIndex].data[index].uuid || 0, this.chat[chatIndex].data[index].inversion)
        this.chat[chatIndex].data.splice(index, 1)
        this.recordState()
      }
    },

    async clearChatByUuid(uuid: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          await ChatAPI.clearChat(this.chat[0].uuid)
          this.chat[0].data = []
          this.recordState()
        }
        return
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        await ChatAPI.clearChat(uuid)
        this.chat[index].data = []
        this.recordState()
      }
    },

    async clearLocalChat() {
      this.chat = []
      this.chatRooms = []
      this.active = null
      this.recordState()
      await router.push({ name: 'Chat' })
    },

    async reloadRoute(uuid?: number) {
      this.recordState()
      await router.push({
        name: 'Chat',
        params: { uuid }
      })
    },

    async updateChatModel(roomId: number, chatModel: string) {
      await RoomAPI.updateChatRoomModel({
        roomId,
        chatModel
      })

      const match = this.chatRooms.find(o => o.uuid === roomId);
      if (match) {
        match.chatModel = chatModel
      }

      this.recordState()
    },

    recordState() {
      setLocalState(this.$state)
    },
  },
})
