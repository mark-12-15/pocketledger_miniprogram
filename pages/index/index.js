const app = getApp()
const { formatDate, getDateLabel, stepDate, isCurrentPeriod, CATEGORY_ICONS } = require('../../utils/util')

Page({
  data: {
    period: 'month',
    currentDate: '',     // YYYY-MM-DD
    dateLabel: '',
    isCurrentPeriod: true,
    summary: { income: 0, expense: 0 },
    records: [],
    recordGroups: [],
    loading: false
  },

  onLoad() {
    if (!app.globalData.token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.setData({ currentDate: formatDate(new Date()) })
    this.refresh()
  },

  onShow() {
    if (!app.globalData.token) return
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    this.setData({ loading: true })
    const { period, currentDate } = this.data
    this.setData({
      dateLabel: getDateLabel(period, currentDate),
      isCurrentPeriod: isCurrentPeriod(period, currentDate)
    })
    try {
      const [summaryRes, listRes] = await Promise.all([
        app.request({ url: `/records/summary?period=${period}&date=${currentDate}` }),
        app.request({ url: `/records?period=${period}&date=${currentDate}` })
      ])
      if (summaryRes.code === 0) this.setData({ summary: summaryRes.data })
      if (listRes.code === 0) {
        const records = listRes.data
        this.setData({ records, recordGroups: this._groupByDate(records) })
      }
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  _groupByDate(records) {
    const map = {}
    records.forEach(r => {
      const date = r.happened_at ? r.happened_at.slice(0, 10) : '未知'
      if (!map[date]) map[date] = []
      map[date].push({
        ...r,
        categoryIcon: CATEGORY_ICONS[r.category] || '💸'
      })
    })
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(date => {
      const recs = map[date]
      const expense = recs.filter(r => r.type === 2).reduce((s, r) => s + Number(r.amount), 0).toFixed(2)
      const income = recs.filter(r => r.type === 1).reduce((s, r) => s + Number(r.amount), 0).toFixed(2)
      recs[recs.length - 1]._last = true
      return { date, expense, income: Number(income) > 0 ? income : 0, records: recs }
    })
  },

  setPeriod(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period })
    this.refresh()
  },

  prevDate() {
    const { period, currentDate } = this.data
    this.setData({ currentDate: stepDate(period, currentDate, -1) })
    this.refresh()
  },

  nextDate() {
    if (this.data.isCurrentPeriod) return
    const { period, currentDate } = this.data
    this.setData({ currentDate: stepDate(period, currentDate, 1) })
    this.refresh()
  },

  onRecordTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  }
})
