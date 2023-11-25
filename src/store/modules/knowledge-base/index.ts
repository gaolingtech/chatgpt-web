import { KnowledgeBaseAPI, RoomAPI } from "@/api";
import { defineStore } from "pinia";

export interface KnowledgeBase {
	_id: string
	name: string
	userId: string
	assistantId: string
	model: string
	introduction: string
}

export const useKnowledgeBaseStore = defineStore('knowledge-base', {
  state: (): {
		knowledgeBases: KnowledgeBase[],
		currentKnowledgeBase?: KnowledgeBase
		currentKnowLedgeBaseChatRooms: Chat.ChatRoom[]
	} => {
    return {
      knowledgeBases: <KnowledgeBase[]>[],
      currentKnowledgeBase: undefined,
      currentKnowLedgeBaseChatRooms: []
    }
  },

  getters: {

  },

  actions: {
    async viewKnowledgeBase(id: string) {
      return Promise.all([
        KnowledgeBaseAPI
          .getKnowledgeBase(id as string)
          .then(r => this.$state.currentKnowledgeBase = r.data),

        RoomAPI.getChatRooms({ knowledgeBaseId: id })
          .then(r => this.$state.currentKnowLedgeBaseChatRooms = r.data)
      ])
    },

    async fetchKnowledgeBases() {
      return KnowledgeBaseAPI
        .listKnowledgeBases()
        .then(r => this.$state.knowledgeBases = r.data)
    },

    clearState() {
      console.log('clear')
      this.$state.currentKnowledgeBase = undefined
    }
  }
})
