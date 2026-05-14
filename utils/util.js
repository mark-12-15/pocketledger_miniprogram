const CATEGORY_ICONS = {
  // 支出
  '进货采购': '📦', '员工工资': '👷', '房租': '🏪',
  '水电网络': '💡', '快递物流': '🚚', '餐饮招待': '🍽️',
  '交通出行': '🚗', '广告推广': '📣', '税费手续费': '🧾',
  '设备维修': '🔧', '办公耗材': '🖊️', '还款': '💳',
  '其他支出': '💸',
  // 收入
  '销售收款': '🛒', '服务收款': '🤝', '预收定金': '📋',
  '退款收回': '↩️', '借款': '🏦', '其他收入': '💰'
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateLabel(period, dateStr) {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (period === 'month') return `${y}年${m}月`
  if (period === 'quarter') {
    const q = Math.ceil(m / 3)
    return `${y}年第${q}季度`
  }
  return `${y}年`
}

function stepDate(period, dateStr, step) {
  const d = new Date(dateStr)
  if (period === 'month') {
    d.setMonth(d.getMonth() + step)
  } else if (period === 'quarter') {
    d.setMonth(d.getMonth() + step * 3)
  } else {
    d.setFullYear(d.getFullYear() + step)
  }
  return formatDate(d)
}

function isCurrentPeriod(period, dateStr) {
  const now = formatDate(new Date())
  const d = dateStr.slice(0, 7)
  const n = now.slice(0, 7)
  if (period === 'month') return d === n
  if (period === 'quarter') {
    return dateStr.slice(0, 4) === now.slice(0, 4) &&
      Math.ceil(parseInt(d.slice(5)) / 3) === Math.ceil(parseInt(n.slice(5)) / 3)
  }
  return dateStr.slice(0, 4) === now.slice(0, 4)
}

module.exports = { CATEGORY_ICONS, formatDate, getDateLabel, stepDate, isCurrentPeriod }
