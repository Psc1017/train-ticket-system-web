import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Tag, 
  Space, 
  Button,
  Statistic,
  Row,
  Col,
  message,
  Tooltip
} from 'antd'
import { 
  ShoppingCartOutlined, 
  DownloadOutlined,
  DeleteOutlined,
  DollarOutlined,
  UserOutlined,
  ReloadOutlined,
  CloseOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'

function PurchaseRecords({ dbReady }) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState(null)

  useEffect(() => {
    if (dbReady) {
      loadPurchases()
      loadStatistics()
    }
  }, [dbReady])

  // 提供手动刷新功能
  const handleRefresh = () => {
    loadPurchases()
    loadStatistics()
  }

  // 删除单条记录
  const handleDelete = async (id) => {
    try {
      await dbManager.deletePurchase(id)
      message.success('记录已删除')
      loadPurchases()
      loadStatistics()
    } catch (error) {
      message.error('删除失败: ' + error.message)
    }
  }

  const loadPurchases = async () => {
    setLoading(true)
    try {
      const data = await dbManager.getAllPurchases()
      // 按时间倒序排列
      const sortedData = data.sort((a, b) => b.timestamp - a.timestamp)
      setPurchases(sortedData)
    } catch (error) {
      message.error('加载购票记录失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const stats = await dbManager.getPurchaseStatistics()
      setStatistics(stats)
      
      // 计算总金额
      const totalAmount = purchases.reduce((sum, p) => sum + p.finalPrice, 0)
      setStatistics(prev => ({
        ...prev,
        totalAmount
      }))
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  useEffect(() => {
    if (purchases.length > 0) {
      const totalAmount = purchases.reduce((sum, p) => sum + p.finalPrice, 0)
      setStatistics(prev => ({
        ...prev,
        totalAmount
      }))
    }
  }, [purchases])

  const handleExport = async () => {
    try {
      const jsonData = await dbManager.exportPurchasesAsJSON()
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `购票记录_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('购票记录已导出')
    } catch (error) {
      message.error('导出失败: ' + error.message)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('确定要清空所有购票记录吗？此操作不可恢复！')) {
      return
    }

    try {
      await dbManager.clearPurchases()
      setPurchases([])
      setStatistics({ totalPurchases: 0, totalAmount: 0 })
      message.success('购票记录已清空')
    } catch (error) {
      message.error('清空失败: ' + error.message)
    }
  }

  const columns = [
    {
      title: '参与者ID',
      dataIndex: 'participantId',
      key: 'participantId',
      render: (text) => <Tag color="blue"><UserOutlined /> {text}</Tag>
    },
    {
      title: '车次',
      dataIndex: 'trainNumber',
      key: 'trainNumber',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '起终点',
      key: 'route',
      render: (_, record) => `${record.fromStation} → ${record.toStation}`
    },
    {
      title: '发车时间',
      dataIndex: 'departureTime',
      key: 'departureTime'
    },
    {
      title: '席别',
      dataIndex: 'seatType',
      key: 'seatType',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '原始票价',
      dataIndex: 'originalPrice',
      key: 'originalPrice',
      render: (price) => price ? `¥${price.toFixed(2)}` : '-'
    },
    {
      title: '折后票价',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      render: (price) => (
        <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
          ¥{price.toFixed(2)}
        </span>
      )
    },
    {
      title: '折扣信息',
      dataIndex: 'discountInfo',
      key: 'discountInfo',
      render: (text) => <Tag color="green">{text}</Tag>
    },
    {
      title: '提前天数',
      dataIndex: 'advanceDays',
      key: 'advanceDays',
      render: (days) => `${days}天`
    },
    {
      title: '购票时间',
      dataIndex: 'purchaseTime',
      key: 'purchaseTime',
      render: (time) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<CloseOutlined />}
          onClick={() => handleDelete(record.id)}
          size="small"
        >
          删除
        </Button>
      )
    }
  ]

  return (
    <div>
      <Card 
        title={<Space><ShoppingCartOutlined />购票记录管理</Space>}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={purchases.length === 0}
            >
              导出JSON
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleClear}
              disabled={purchases.length === 0}
            >
              清空记录
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {statistics && (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic 
                title="总购票数" 
                value={statistics.totalPurchases}
                prefix={<ShoppingCartOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="总金额"
                value={statistics.totalAmount || 0}
                prefix={<DollarOutlined />}
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="平均票价" 
                value={statistics.totalPurchases > 0 ? (statistics.totalAmount / statistics.totalPurchases) : 0}
                prefix={<DollarOutlined />}
                precision={2}
              />
            </Col>
          </Row>
        )}
      </Card>

      <Card title="购票记录详情">
        <Table 
          columns={columns} 
          dataSource={purchases}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  )
}

export default PurchaseRecords

