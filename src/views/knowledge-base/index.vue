<template>
  <div class="w-full h-full p-4 bg-white shadow shadow-gray-300">
    <div class="flex gap-4 items-center mb-4">
      <div class="text-xl text-blue-600 font-semibold">
        我的知识库
      </div>
      <n-button size="small" round @click="createModalShow = true">
        创建
        <template #icon>
          <SvgIcon icon="material-symbols:add" />
        </template>
      </n-button>
    </div>

    <div class="flex gap-4 flex-wrap">
      <div
        v-for="knowledgeBase in store.$state.knowledgeBases"
        :key="knowledgeBase._id"
        :class="[
          'w-48 h-48 aspect-square p-4 shadow shadow-gray-400 flex flex-col',
          'hover:shadow-xl hover:shadow-gray-300 cursor-pointer'
        ]"
        @click="$router.push(`/knowledge-base/${knowledgeBase._id}`)"
      >
        <div class="flex gap-2 mb-2">
          <SvgIcon icon="majesticons:library-line" class="text-xl" />
          <span>
            {{ knowledgeBase.name }}
          </span>
        </div>

        <div class="text-gray-500 overflow-hidden overflow-ellipsis flex-1">
          {{ knowledgeBase.introduction || '该知识库暂无介绍' }}
        </div>
      </div>
    </div>

    <n-modal v-model:show="createModalShow">
      <n-card style="width: 300px">
        <n-form>
          <n-form-item label="基础模型">
            <n-select
              v-model:value="createForm.model"
              :options="[
                { label: 'gpt-4-1106-preview', value: 'gpt-4-1106-preview' },
                { label: 'gpt-3.5-turbo-1106', value: 'gpt-3.5-turbo-1106' },
              ]"
            />
          </n-form-item>

          <n-form-item label="知识库名字">
            <n-input v-model:value="createForm.name" />
          </n-form-item>

          <n-form-item label="知识库介绍">
            <n-input v-model:value="createForm.introduction" type="textarea" />
          </n-form-item>

          <div class="flex justify-end gap-4">
            <n-button type="error" @click="createModalShow = false">
              取消
            </n-button>
            <n-button type="primary" :loading="createLoading" @click="handleCreate">
              创建
            </n-button>
          </div>
        </n-form>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { KnowledgeBaseAPI } from "@/api";
import { SvgIcon } from "@/components/common/SvgIcon";
import { useKnowledgeBaseStore } from "@/store/modules/knowledge-base";
import { onMounted, ref } from "vue";
import { useMessage } from 'naive-ui'

const message = useMessage();
const createModalShow = ref(false)
const createForm = ref({
  name: '',
  model: '',
  introduction: ''
})

const createLoading = ref(false)
const store = useKnowledgeBaseStore()

const handleCreate = async () => {
  createLoading.value = true

  KnowledgeBaseAPI.createKnowledgeBase(createForm.value)
    .then(() => {
      message.success('知识库创建成功')
      createModalShow.value = false
      return store.fetchKnowledgeBases()
    })
    .catch(e => {
      message.error(e.message)
    })
    .finally(() => {
      createLoading.value = false
    })
}

onMounted(() => {
  store.fetchKnowledgeBases()
})
</script>

