import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Upload, 
  message, 
  Progress, 
  Space,
  Alert,
  Divider,
  Tag,
  Input
} from 'antd'
import { 
  UploadOutlined, 
  DeleteOutlined, 
  FileExcelOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import dbManager from '../utils/indexedDB'
import { generateSampleData } from '../utils/dataGenerator'

function DataManagement({ dbReady }) {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importingText, setImportingText] = useState('')
  const [dataSourceUrl, setDataSourceUrl] = useState('')

  // 初始化读取本地保存的数据源URL
  useEffect(() => {
    const saved = localStorage.getItem('sharedDataSourceUrl')
    if (saved) setDataSourceUrl(saved)
  }, [])

  const handleImportSampleData = async () => {
    if (!dbReady) {
      message.error('数据库未初始化')
      return
    }

    setImporting(true)
    setProgress(0)
    
    try {
      message.info('开始生成示例数据...')
      
      // 生成100万条示例数据
      const totalRecords = 1000000
      const batchSize = 100000
      
      for (let i = 0; i < totalRecords / batchSize; i++) {
        setImportingText(`正在生成第 ${i + 1} 批数据...`)
        const sampleData = generateSampleData(batchSize)
        
        await dbManager.importTickets(sampleData)
        
        const newProgress = Math.round(((i + 1) * batchSize / totalRecords) * 100)
        setProgress(newProgress)
        message.success(`已导入 ${(i + 1) * batchSize} 条数据`)
      }
      
      message.success('数据导入成功！')
      setProgress(100)
    } catch (error) {
      message.error('数据导入失败: ' + error.message)
    } finally {
      setImporting(false)
      setImportingText('')
    }
  }

  const handleImportFromFile = async (file) => {
    if (!dbReady) {
      message.error('数据库未初始化')
      return false
    }

    setImporting(true)
    setProgress(0)
    setImportingText('正在读取文件...')
    
    try {
      const text = await file.text()
      setProgress(10)
      setImportingText('正在解析JSON数据...')
      
      const data = JSON.parse(text)
      
      if (!Array.isArray(data)) {
        message.error('数据格式错误，请配入JSON数组')
        return false
      }

      setImportingText(`准备导入 ${data.length} 条数据...`)
      setProgress(20)
      
      // 更真实的进度更新（虽然IndexedDB没有实时进度回调）
      // 显示进度
      let progressCounter = 20
      const updateProgressInterval = setInterval(() => {
        progressCounter = Math.min(progressCounter + 1, 95)
        setProgress(progressCounter)
        setImportingText(`正在导入数据，请稍候... (约${Math.floor(progressCounter)}%)`)
      }, 1000)
      
      console.log('开始导入数据...')
      await dbManager.importTickets(data)
      
      clearInterval(updateProgressInterval)
      setProgress(100)
      setImportingText('导入完成！')
      console.log('数据导入完成')
      message.success(`文件导入成功！共导入 ${data.length} 条数据`)
      return false
    } catch (error) {
      message.error('文件导入失败: ' + error.message)
      console.error('导入错误:', error)
      return false
    } finally {
      setTimeout(() => {
        setImporting(false)
        setImportingText('')
        setProgress(0)
      }, 2000)
    }
  }

  // 从数据源URL同步
  const handleSyncFromUrl = async () => {
    if (!dbReady) {
      message.error('数据库未初始化')
      return
    }
    if (!dataSourceUrl || !/^https?:\/\//i.test(dataSourceUrl)) {
      message.warning('请填写有效的数据源URL（http/https）')
      return
    }

    // 保存URL到本地
    localStorage.setItem('sharedDataSourceUrl', dataSourceUrl)

    setImporting(true)
    setProgress(0)
    setImportingText('正在从数据源获取文件...')

    try {
      // 尝试获取远端JSON文本
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5分钟超时

      // 使用服务端代理，绕过 CORS：/api/proxy?url=<encoded>
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(dataSourceUrl)}`
      const response = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) throw new Error(`网络错误 ${response.status}`)

      setImportingText('正在下载数据...')
      setProgress(10)

      // 优先尝试逐块读取以便显示下载进度（若不可用则退化为一次性读取）
      let text
      try {
        const reader = response.body?.getReader()
        if (reader) {
          const chunks = []
          let received = 0
          const contentLength = Number(response.headers.get('content-length')) || 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            if (contentLength) {
              const pct = 10 + Math.min(70, Math.floor((received / contentLength) * 70))
              setProgress(pct)
            }
          }
          const decoder = new TextDecoder('utf-8')
          text = decoder.decode(new Blob(chunks))
        } else {
          text = await response.text()
        }
      } catch (_) {
        // 回退到一次性读取
        text = await response.text()
      }

      setImportingText('正在解析JSON数据...')
      setProgress((p) => Math.max(p, 85))

      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('数据格式必须为JSON数组')

      setImportingText(`准备导入 ${data.length} 条数据...`)
      setProgress(90)

      // 导入数据库
      await dbManager.importTickets(data)

      setImportingText('导入完成！')
      setProgress(100)
      message.success(`已从数据源导入 ${data.length} 条数据`)
    } catch (error) {
      if (error.name === 'AbortError') {
        message.error('同步超时，请检查网络或稍后重试')
      } else {
        message.error('同步失败: ' + error.message)
      }
      console.error('同步失败:', error)
    } finally {
      setTimeout(() => {
        setImporting(false)
        setImportingText('')
        setProgress(0)
      }, 1500)
    }
  }

  const handleClearData = async () => {
    if (!window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      return
    }

    try {
      await dbManager.clearAll()
      message.success('数据已清空')
    } catch (error) {
      message.error('清空数据失败: ' + error.message)
    }
  }

  return (
    <div>
      <Alert
        message="数据管理说明"
        description={
          <div>
            <p>本系统使用 IndexedDB 存储数据，支持千万级数据的快速查询。</p>
            <p>数据导入功能支持：</p>
            <ul>
              <li>点击"生成示例数据"可快速生成100万条测试数据</li>
              <li>上传JSON文件可导入自定义数据</li>
              <li>数据清空功能会删除所有已导入的数据</li>
              <li><strong>站点信息会自动从票价数据中提取并保存，首次加载可能需要几秒钟</strong></li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card 
        title={<Space><DatabaseOutlined />数据导入</Space>}
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>共享数据源URL（所有设备共用）：</div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="粘贴JSON直链，例如 GitHub Releases 资源链接"
                value={dataSourceUrl}
                onChange={(e) => setDataSourceUrl(e.target.value)}
                disabled={importing}
              />
              <Button type="primary" onClick={handleSyncFromUrl} loading={importing}>
                一键同步
              </Button>
            </Space.Compact>
            <Tag color="geekblue" style={{ marginTop: 8 }}>
              将URL保存在本机，启动时可再次使用；更新远端文件后点击一键同步即可全端生效
            </Tag>
          </div>

          <div>
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              onClick={handleImportSampleData}
              loading={importing}
              disabled={!dbReady}
              size="large"
            >
              生成100万条示例数据
            </Button>
            <Tag color="blue" style={{ marginLeft: 16 }}>
              用于功能测试和数据展示
            </Tag>
          </div>

          <Divider />

          <div>
            <Upload
              accept=".json"
              beforeUpload={handleImportFromFile}
              showUploadList={false}
            >
              <Button
                icon={<UploadOutlined />}
                disabled={!dbReady || importing}
                size="large"
              >
                上传JSON文件导入数据
              </Button>
            </Upload>
            <Tag color="orange" style={{ marginLeft: 16 }}>
              支持自定义数据文件
            </Tag>
          </div>

          <Divider />

          <div>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleClearData}
              disabled={!dbReady || importing}
              size="large"
            >
              清空所有数据
            </Button>
            <Tag color="red" style={{ marginLeft: 16 }}>
              此操作不可恢复
            </Tag>
          </div>
        </Space>
      </Card>

      {importing && (
        <Card title="导入进度">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>{importingText}</div>
            <Progress percent={progress} status="active" />
          </Space>
        </Card>
      )}

      <Card title="数据格式说明">
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
          <pre style={{ margin: 0 }}>
{`// 票价数据格式示例
[
  {
    "trainNumber": "G1",
    "fromStation": "北京南",
    "toStation": "上海虹桥",
    "departureTime": "07:00",
    "arrivalTime": "11:30",
    "price": 553.0,
    "seatType": "二等座"
  }
]`}
          </pre>
        </div>
      </Card>
    </div>
  )
}

export default DataManagement

