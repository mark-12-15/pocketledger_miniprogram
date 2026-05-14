const app = getApp()
const { formatDate } = require('../../utils/util')

const EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: '🍜' }, { name: '超市', icon: '🛒' }, { name: '外卖', icon: '🥡' },
  { name: '交通', icon: '🚌' }, { name: '打车', icon: '🚕' }, { name: '加油', icon: '⛽' },
  { name: '娱乐', icon: '🎮' }, { name: '电影', icon: '🎬' }, { name: '购物', icon: '🛍️' },
  { name: '医疗', icon: '💊' }, { name: '健身', icon: '🏃' }, { name: '居家', icon: '🏠' },
  { name: '通讯', icon: '📱' }, { name: '教育', icon: '📚' }, { name: '其他', icon: '💸' }
]

const INCOME_CATEGORIES = [
  { name: '工资', icon: '💰' }, { name: '奖金', icon: '🎁' }, { name: '理财', icon: '📈' },
  { name: '红包', icon: '🧧' }, { name: '转账', icon: '💸' }, { name: '其他', icon: '💵' }
]

Page({
  data: {
    type: 2,           // 1=收入 2=支出
    method: 'manual',  // manual | photo | file | voice
    amount: '',
    category: '',
    note: '',
    happenedAt: '',
    categories: EXPENSE_CATEGORIES,
    submitting: false,
    // 上传相关
    uploadFile: '',
    uploadFileName: '',
    parseMessage: '',
    parseStatusClass: '',
    recording: false,
    recordId: null,
    pollTimer: null
  },

  onLoad() {
    this.setData({ happenedAt: formatDate(new Date()) })
  },

  onUnload() {
    if (this.data.pollTimer) clearInterval(this.data.pollTimer)
  },

  setType(e) {
    const type = Number(e.currentTarget.dataset.type)
    this.setData({
      type,
      category: '',
      categories: type === 2 ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    })
  },

  setMethod(e) {
    this.setData({ method: e.currentTarget.dataset.method, parseMessage: '', uploadFile: '', uploadFileName: '' })
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }) },
  onNoteInput(e) { this.setData({ note: e.detail.value }) },
  onDateChange(e) { this.setData({ happenedAt: e.detail.value }) },
  setCategory(e) { this.setData({ category: e.currentTarget.dataset.name }) },

  // 手动提交
  async onSubmit() {
    const { type, amount, category, note, happenedAt } = this.data
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const res = await app.request({
        url: '/records',
        method: 'POST',
        data: { type, amount: Number(amount), category: category || null, note: note || null, happened_at: happenedAt }
      })
      if (res.code === 0) {
        wx.showToast({ title: '记录成功', icon: 'success' })
        setTimeout(() => {
          this.setData({ amount: '', category: '', note: '' })
          wx.switchTab({ url: '/pages/index/index' })
        }, 1000)
      } else {
        wx.showToast({ title: res.message || '记录失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 拍照
  onChoosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath
        this.setData({ uploadFile: path })
        this._uploadFile(path, 'image')
      }
    })
  },

  // 选 PDF
  onChooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({ uploadFileName: file.name })
        this._uploadFile(file.path, 'pdf')
      }
    })
  },

  // 上传文件到后端
  async _uploadFile(filePath, fileType) {
    this.setData({ parseMessage: '上传中...', parseStatusClass: 'pending' })
    const token = app.globalData.token
    wx.uploadFile({
      url: app.globalData.baseUrl + '/upload',
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 0) {
            const recordId = data.data.recordId
            this.setData({ recordId, parseMessage: '解析中，稍等...', parseStatusClass: 'pending' })
            this._pollParseStatus(recordId)
          } else {
            this.setData({ parseMessage: data.message || '上传失败', parseStatusClass: 'error' })
          }
        } catch {
          this.setData({ parseMessage: '上传失败', parseStatusClass: 'error' })
        }
      },
      fail: () => {
        this.setData({ parseMessage: '上传失败，请重试', parseStatusClass: 'error' })
      }
    })
  },

  // 轮询解析状态
  _pollParseStatus(recordId) {
    let count = 0
    const timer = setInterval(async () => {
      count++
      if (count > 30) {
        clearInterval(timer)
        this.setData({ parseMessage: '解析超时，可在账单列表查看', parseStatusClass: 'error' })
        return
      }
      try {
        const res = await app.request({ url: `/upload/status/${recordId}` })
        if (res.code === 0) {
          const { parse_status } = res.data
          if (parse_status === 2) {
            clearInterval(timer)
            this.setData({ parseMessage: '解析成功！已记录到账单', parseStatusClass: 'success' })
            setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1500)
          } else if (parse_status === 3) {
            clearInterval(timer)
            this.setData({ parseMessage: '解析失败，请手动录入', parseStatusClass: 'error' })
          }
        }
      } catch { /* ignore */ }
    }, 2000)
    this.setData({ pollTimer: timer })
  },

  // 语音录制
  onVoiceStart() {
    const rm = wx.getRecorderManager()
    rm.start({ duration: 60000, format: 'aac' })
    this.recorderManager = rm
    this.setData({ recording: true, parseMessage: '', parseStatusClass: '' })
    rm.onStop((res) => {
      this.setData({ recording: false })
      this._uploadFile(res.tempFilePath, 'audio')
    })
  },

  onVoiceEnd() {
    if (!this.data.recording) return
    this.recorderManager && this.recorderManager.stop()
  }
})
