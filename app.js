App({
  globalData: {
    token: '',
    userInfo: null,
    baseUrl: 'https://pocket-ledger-api-257743-7-1258525494.sh.run.tcloudbase.com'
  },

  onLaunch() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
    }
  },

  // 统一请求封装
  request(options) {
    const token = this.globalData.token
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        success(res) {
          if (res.data.code === 401) {
            wx.removeStorageSync('token')
            wx.removeStorageSync('userInfo')
            wx.reLaunch({ url: '/pages/login/login' })
            return
          }
          resolve(res.data)
        },
        fail: reject
      })
    })
  }
})
