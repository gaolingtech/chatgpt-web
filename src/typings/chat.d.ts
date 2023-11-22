declare namespace Chat {
  import { ChatModel } from "@/components/common/Setting/model"

  interface Chat {
    uuid?: number
    dateTime: string
    text: string
		images?: string[]
    inversion?: boolean
    responseCount?: number
    error?: boolean
    loading?: boolean
    conversationOptions?: ConversationRequest | null
    requestOptions: { prompt: string; options?: ConversationRequest | null }
    usage?: {
      completion_tokens: number
      prompt_tokens: number
      total_tokens: number
      estimated: boolean
    }
  }

  interface ChatRoom {
    title: string
    isEdit: boolean
    uuid: number
    loading?: boolean
    all?: boolean
    prompt?: string
		usingContext: boolean
		usingImageGeneration: boolean
    chatModel?: ChatModel
  }

  interface ChatState {
    active: number | null
    usingContext: boolean;
    chatRooms: ChatRoom[]
    chat: { uuid: number; data: Chat[] }[]
  }

  interface ConversationRequest {
    conversationId?: string
    parentMessageId?: string
  }

  interface ConversationResponse {
    conversationId: string
    detail: {
      choices: { finish_reason: string; index: number; logprobs: any; text: string }[]
      created: number
      id: string
      model: string
      object: string
      usage: { completion_tokens: number; prompt_tokens: number; total_tokens: number }
    }
    id: string
    parentMessageId: string
    role: string
    text: string
  }

	interface ImageGenerationResponse {
		conversationId: string
		created: number
		data: { url: string }[]
		detail: {}
	}
}
