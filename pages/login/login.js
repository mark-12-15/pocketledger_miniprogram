const app = getApp()

Page({
  data: {
    step: 'wx',           // 'wx' | 'phone'
    wxLoginBtnOpenType: 'getPhoneNumber',
    phone: '',
    code: '',
    loading: false,
    sendingCode: false,
    codeCooldown: 0,
    tempToken: '',        // wx-login 后拿到的临时 token（未绑定手机号时）
  },

  onLoad() {
    // 已登录直接跳首页
    if (app.globalData.token) {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  // 微信一键登录（同时尝试获取手机号）
  async onGetPhoneNumber(e) {
    if (e.detail.errno !== 0) {
      // 用户拒绝授权手机号，降级到手动绑定
      this._wxLoginOnly()
      return
    }
    this.setData({ loading: true })
    try {
      const loginRes = await new Promise((resolve, reject) =>
        wx.login({ success: resolve, fail: reject })
      )
      const res = await app.request({
        url: '/auth/wx-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          phoneCode: e.detail.code
        }
      })
      if (res.code === 0) {
        this._saveAndJump(res.data.token, res.data.user)
      } else {
        wx.showToast({ title: res.message || '登录失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 仅 wx.login，不获取手机号
  async _wxLoginOnly() {
    this.setData({ loading: true })
    try {
      const loginRes = await new Promise((resolve, reject) =>
        wx.login({ success: resolve, fail: reject })
      )
      const res = await app.request({
        url: '/auth/wx-login',
        method: 'POST',
        data: { code: loginRes.code }
      })
      if (res.code === 0 && res.data.token) {
        // 已绑定手机号，直接登录
        this._saveAndJump(res.data.token, res.data.user)
      } else if (res.code === 0 && res.data.needBind) {
        // 需要绑定手机号
        this.setData({ step: 'phone', tempToken: res.data.tempToken })
      } else {
        wx.showToast({ title: res.message || '登录失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onWxLogin() {
    // 由 getPhoneNumber open-type 触发，此函数作为兜底
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value })
  },

  async onSendCode() {
    const { phone } = this.data
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    this.setData({ sendingCode: true })
    try {
      const res = await app.request({
        url: '/auth/send-sms',
        method: 'POST',
        data: { phone }
      })
      if (res.code === 0) {
        wx.showToast({ title: '验证码已发送', icon: 'success' })
        this._startCooldown()
      } else {
        wx.showToast({ title: res.message || '发送失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ sendingCode: false })
    }
  },

  _startCooldown() {
    this.setData({ codeCooldown: 60 })
    const timer = setInterval(() => {
      const c = this.data.codeCooldown - 1
      if (c <= 0) {
        clearInterval(timer)
        this.setData({ codeCooldown: 0 })
      } else {
        this.setData({ codeCooldown: c })
      }
    }, 1000)
  },

  async onBindPhone() {
    const { phone, code, tempToken } = this.data
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      // 临时设置 token 用于 bind-phone 请求
      const prevToken = app.globalData.token
      app.globalData.token = tempToken
      const res = await app.request({
        url: '/auth/bind-phone',
        method: 'POST',
        data: { phone, smsCode: code }
      })
      if (res.code === 0) {
        this._saveAndJump(res.data.token, res.data.user)
      } else {
        app.globalData.token = prevToken
        wx.showToast({ title: res.message || '绑定失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  _saveAndJump(token, user) {
    app.globalData.token = token
    app.globalData.userInfo = user
    wx.setStorageSync('token', token)
    wx.setStorageSync('userInfo', user)
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
