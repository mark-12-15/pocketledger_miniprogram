const app = getApp()
const { CATEGORY_ICONS } = require('../../utils/util')

const INPUT_METHOD_LABELS = { 1: '手动输入', 2: '图片识别', 3: 'PDF 解析', 4: '语音识别' }

Page({
  data: {
    record: null,
    loading: true,
    editing: false,
    editData: {},
    saving: false,
    deleting: false,
    inputMethodLabel: ''
  },

  onLoad(options) {
    this.recordId = options.id
    this.loadRecord()
  },

  async loadRecord() {
    this.setData({ loading: true })
    try {
      const res = await app.request({ url: `/records/${this.recordId}` })
      if (res.code === 0) {
        const record = {
          ...res.data,
          categoryIcon: CATEGORY_ICONS[res.data.category] || '💸'
        }
        this.setData({
          record,
          loading: false,
          inputMethodLabel: INPUT_METHOD_LABELS[record.input_method] || '未知'
        })
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        wx.navigateBack()
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  startEdit() {
    const { record } = this.data
    this.setData({
      editing: true,
      editData: {
        type: record.type,
        amount: String(record.amount),
        category: record.category || '',
        note: record.note || '',
        happened_at: record.happened_at ? record.happened_at.slice(0, 10) : ''
      }
    })
  },

  cancelEdit() {
    this.setData({ editing: false })
  },

  onEditAmount(e) { this.setData({ 'editData.amount': e.detail.value }) },
  onEditCategory(e) { this.setData({ 'editData.category': e.detail.value }) },
  onEditNote(e) { this.setData({ 'editData.note': e.detail.value }) },
  onEditDate(e) { this.setData({ 'editData.happened_at': e.detail.value }) },
  onEditType(e) { this.setData({ 'editData.type': Number(e.currentTarget.dataset.type) }) },

  async onSave() {
    const { editData } = this.data
    if (!editData.amount || Number(editData.amount) <= 0) {
      wx.showToast({ title: '金额不能为空', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const res = await app.request({
        url: `/records/${this.recordId}`,
        method: 'PUT',
        data: {
          type: editData.type,
          amount: Number(editData.amount),
          category: editData.category || null,
          note: editData.note || null,
          happened_at: editData.happened_at
        }
      })
      if (res.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ editing: false })
        this.loadRecord()
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除这条账单吗？',
      confirmColor: '#DC2626',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ deleting: true })
        try {
          const result = await app.request({
            url: `/records/${this.recordId}`,
            method: 'DELETE'
          })
          if (result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          } else {
            wx.showToast({ title: result.message || '删除失败', icon: 'none' })
          }
        } catch {
          wx.showToast({ title: '网络错误', icon: 'none' })
        } finally {
          this.setData({ deleting: false })
        }
      }
    })
  }
})
