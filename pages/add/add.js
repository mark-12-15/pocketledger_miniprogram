const app = getApp()
const { formatDate } = require('../../utils/util')

const EXPENSE_CATEGORIES = [
  { name: '进货采购', icon: '📦' }, { name: '员工工资', icon: '👷' }, { name: '房租', icon: '🏪' },
  { name: '水电网络', icon: '💡' }, { name: '快递物流', icon: '🚚' }, { name: '餐饮招待', icon: '🍽️' },
  { name: '交通出行', icon: '🚗' }, { name: '广告推广', icon: '📣' }, { name: '税费手续费', icon: '🧾' },
  { name: '设备维修', icon: '🔧' }, { name: '办公耗材', icon: '🖊️' }, { name: '还款', icon: '💳' },
  { name: '其他支出', icon: '💸' }
]

const INCOME_CATEGORIES = [
  { name: '销售收款', icon: '🛒' }, { name: '服务收款', icon: '🤝' }, { name: '预收定金', icon: '📋' },
  { name: '退款收回', icon: '↩️' }, { name: '借款', icon: '🏦' }, { name: '其他收入', icon: '💰' }
]

Page({
  data: {
    type: 2,           // 1=收入 2=支出
    method: 'photo',   // photo | manual | voice | file（按优先级排序）
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
    pollTimer: null,
    // AI 解析确认
    showConfirm: false,
    confirmData: null,
    confirming: false,
    // 本月财务上下文
    monthExpense: '0.00',
    monthIncome: '0.00'
  },

  onLoad() {
    this.setData({ happenedAt: formatDate(new Date()) })
  },

  onShow() {
    this._loadMonthSummary()
  },

  async _loadMonthSummary() {
    try {
      const now = new Date()
      const res = await app.request({
        url: `/records/summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      })
      if (res.code === 0) {
        this.setData({
          monthExpense: Number(res.data.expense || 0).toFixed(2),
          monthIncome: Number(res.data.income || 0).toFixed(2)
        })
      }
    } catch { /* 静默失败，不影响记账主流程 */ }
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

  // 拍照（直接调起相机）
  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath
        this.setData({ uploadFile: path })
        this._uploadFile(path, 'image')
      }
    })
  },

  // 从相册选择
  onChooseAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath
        this.setData({ uploadFile: path })
        this._uploadFile(path, 'image')
      }
    })
  },

  // 重新上传（清空当前状态）
  onReupload() {
    if (this.data.pollTimer) clearInterval(this.data.pollTimer)
    this.setData({
      uploadFile: '',
      parseMessage: '',
      parseStatusClass: '',
      recordId: null,
      pollTimer: null,
      showConfirm: false,
      confirmData: null
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
            const recordId = data.data.id
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
        this.setData({ parseMessage: '解析超时，请手动录入', parseStatusClass: 'error' })
        return
      }
      try {
        const res = await app.request({ url: `/upload/status/${recordId}` })
        if (res.code === 0) {
          const { parse_status, type, amount, category, note, happened_at } = res.data
          if (parse_status === 2) {
            clearInterval(timer)
            // 用用户选的收/支类型，不采用 GLM 判断
            const userType = this.data.type
            const confirmCategories = userType === 1 ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
            this.setData({
              parseMessage: '',
              showConfirm: true,
              confirmData: { type: userType, amount: String(amount), category, note: note || '', happened_at },
              categories: confirmCategories
            })
          } else if (parse_status === 3) {
            clearInterval(timer)
            this.setData({ uploadFile: '', parseMessage: '解析失败', parseStatusClass: 'error' })
          }
        }
      } catch { /* ignore */ }
    }, 2000)
    this.setData({ pollTimer: timer })
  },

  // 确认表单字段更新
  onConfirmAmountInput(e) {
    this.setData({ 'confirmData.amount': e.detail.value })
  },
  onConfirmNoteInput(e) {
    this.setData({ 'confirmData.note': e.detail.value })
  },
  onConfirmDateChange(e) {
    this.setData({ 'confirmData.happened_at': e.detail.value })
  },
  onConfirmTypeChange(e) {
    const type = Number(e.currentTarget.dataset.type)
    this.setData({
      'confirmData.type': type,
      'confirmData.category': '',
      categories: type === 2 ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    })
  },
  onConfirmCategory(e) {
    this.setData({ 'confirmData.category': e.currentTarget.dataset.name })
  },

  // 确认入账
  async onConfirmRecord() {
    const { confirmData, recordId } = this.data
    if (!confirmData.amount || Number(confirmData.amount) <= 0) {
      wx.showToast({ title: '请确认金额', icon: 'none' })
      return
    }
    this.setData({ confirming: true })
    try {
      const res = await app.request({
        url: `/records/${recordId}`,
        method: 'PUT',
        data: {
          type: confirmData.type,
          amount: Number(confirmData.amount),
          category: confirmData.category || null,
          note: confirmData.note || null,
          happened_at: confirmData.happened_at,
          parse_status: 4  // 用户已确认
        }
      })
      if (res.code === 0) {
        wx.showToast({ title: '已入账', icon: 'success' })
        setTimeout(() => {
          this.setData({
            showConfirm: false, confirmData: null,
            uploadFile: '', uploadFileName: '',
            parseMessage: '', parseStatusClass: '',
            recordId: null
          })
          this._loadMonthSummary()
        }, 800)
      } else {
        wx.showToast({ title: res.message || '入账失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ confirming: false })
    }
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
