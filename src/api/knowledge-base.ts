import post, { get } from "@/utils/request";

export const KnowledgeBaseAPI = {
  createKnowledgeBase(data: { name: string, model: string, introduction: string }) {
    return post({
      url: '/knowledge-base/create',
      data
    })
  },

  listKnowledgeBases() {
    return get({
      url: '/knowledge-base/list'
    })
  },

  getKnowledgeBase(id: string) {
    return get({
      url: `/knowledge-base/get/${id}`
    })
  },

  askToKnowledgeBase(roomId: string, prompt: string) {
    return post<Chat.KnowledgeBaseAskingResponse>({
      url: '/knowledge-base/ask',
      data: {
        roomId,
        prompt,
      }
    })
  }
}
