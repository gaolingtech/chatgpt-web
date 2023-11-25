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
      url: `/knowledge-base/get/${id}/info`
    })
  },

  getKnowledgeBaseFiles(id: string) {
    return get({
      url: `/knowledge-base/get/${id}/files`
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
  },
  feedForKnowledgeBase(file: File, id: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('knowledgeBaseId', id)

    return post({
      url: '/knowledge-base/feed',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}
