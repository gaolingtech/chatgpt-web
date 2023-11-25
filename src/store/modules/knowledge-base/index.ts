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

export interface OpenFileInfo {
	object: string
	id: string
	purpose: string
	filename: string
	bytes: number
	created_at: number
	status: string
	status_details: any
}

export const useKnowledgeBaseStore = defineStore('knowledge-base', {
  state: (): {
		knowledgeBases: KnowledgeBase[],
		currentKnowledgeBase: {
			baseInfo?: KnowledgeBase
			chatRooms: Chat.ChatRoom[]
			files: OpenFileInfo[]
		}
	} => {
    return {
      knowledgeBases: <KnowledgeBase[]>[],
      currentKnowledgeBase: {
        baseInfo: undefined,
        chatRooms: [],
        files: []
      },
    }
  },

  getters: {

  },

  actions: {
    async viewKnowledgeBase(id: string) {
      return Promise.all([
        KnowledgeBaseAPI
          .getKnowledgeBase(id as string)
          .then(r => this.$state.currentKnowledgeBase.baseInfo = r.data),

        RoomAPI.getChatRooms({ knowledgeBaseId: id })
          .then(r => this.$state.currentKnowledgeBase.chatRooms = r.data),

        KnowledgeBaseAPI
          .getKnowledgeBaseFiles(id as string)
          .then(r => this.$state.currentKnowledgeBase.files = r.data),
      ])
    },

    refreshCurrent() {
      if (!this.currentKnowledgeBase.baseInfo) {
        return
      }

      return this.viewKnowledgeBase(this.currentKnowledgeBase.baseInfo._id)
    },

    async fetchKnowledgeBases() {
      return KnowledgeBaseAPI
        .listKnowledgeBases()
        .then(r => this.$state.knowledgeBases = r.data)
    },

    clearState() {
      console.log('clear')
      this.$state.currentKnowledgeBase.baseInfo = undefined
    }
  }
})
