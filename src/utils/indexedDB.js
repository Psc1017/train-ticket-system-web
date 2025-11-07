/**
 * IndexedDB 数据库管理
 * 用于存储和检索千万级高铁票价数据
 */

const DB_NAME = 'TrainTicketDB'
const DB_VERSION = 4
const STORE_TICKETS = 'tickets'
const STORE_STATIONS = 'stations'
const STORE_ROUTES = 'routes'
const STORE_PURCHASES = 'purchases' // 购票记录表
const STORE_SURVEYS = 'surveys' // 问卷表

class DBManager {
  constructor() {
    this.db = null
  }

  // 初始化数据库
  async init() {
    // 如果数据库已连接且未关闭，直接返回
    if (this.db) {
      try {
        // 检查数据库连接是否有效
        if (this.db.objectStoreNames && this.db.objectStoreNames.length > 0) {
          return this.db
        }
      } catch (e) {
        // 如果检查失败，说明连接已关闭，需要重新打开
        this.db = null
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = (event) => {
          console.error('打开数据库失败:', event.target.error)
          reject(event.target.error || new Error('无法打开数据库'))
        }
        
        request.onsuccess = () => {
          try {
            this.db = request.result
            
            // 监听数据库关闭事件
            this.db.onclose = () => {
              console.warn('数据库连接已关闭')
              this.db = null
            }
            
            // 监听数据库错误事件（只记录严重错误，避免刷屏）
            this.db.onerror = (event) => {
              // 只记录非预期的错误，忽略常见的操作错误（如重复键等）
              const error = event.target?.error
              if (error && error.name !== 'ConstraintError' && error.name !== 'DataError') {
                console.error('数据库严重错误:', error)
              }
            }
            
            console.log('数据库初始化成功')
            resolve(this.db)
          } catch (error) {
            console.error('数据库初始化后处理失败:', error)
            reject(error)
          }
        }
        
        request.onblocked = () => {
          console.warn('数据库升级被阻塞，请关闭其他标签页')
        }

        request.onupgradeneeded = (event) => {
          const db = event.target.result

          // 创建票价数据存储
          if (!db.objectStoreNames.contains(STORE_TICKETS)) {
            const ticketStore = db.createObjectStore(STORE_TICKETS, { keyPath: 'id', autoIncrement: true })
            ticketStore.createIndex('fromStation', 'fromStation', { unique: false })
            ticketStore.createIndex('toStation', 'toStation', { unique: false })
            ticketStore.createIndex('trainNumber', 'trainNumber', { unique: false })
            ticketStore.createIndex('departureTime', 'departureTime', { unique: false })
          }

          // 创建站点数据存储
          if (!db.objectStoreNames.contains(STORE_STATIONS)) {
            const stationStore = db.createObjectStore(STORE_STATIONS, { keyPath: 'id', autoIncrement: true })
            stationStore.createIndex('name', 'name', { unique: true })
            stationStore.createIndex('code', 'code', { unique: true })
          }

          // 创建路线数据存储
          if (!db.objectStoreNames.contains(STORE_ROUTES)) {
            const routeStore = db.createObjectStore(STORE_ROUTES, { keyPath: 'id', autoIncrement: true })
            routeStore.createIndex('fromTo', ['fromStation', 'toStation'], { unique: false })
          }

          // 创建购票记录存储
          if (!db.objectStoreNames.contains(STORE_PURCHASES)) {
            const purchaseStore = db.createObjectStore(STORE_PURCHASES, { keyPath: 'id', autoIncrement: true })
            purchaseStore.createIndex('participantId', 'participantId', { unique: false })
            purchaseStore.createIndex('trainNumber', 'trainNumber', { unique: false })
            purchaseStore.createIndex('purchaseTime', 'purchaseTime', { unique: false })
            purchaseStore.createIndex('advanceDays', 'advanceDays', { unique: false })
          }

          // 创建问卷存储
          if (!db.objectStoreNames.contains(STORE_SURVEYS)) {
            const surveyStore = db.createObjectStore(STORE_SURVEYS, { keyPath: 'id', autoIncrement: true })
            surveyStore.createIndex('participantId', 'participantId', { unique: false })
            surveyStore.createIndex('createdAt', 'createdAt', { unique: false })
          }
        }
      } catch (error) {
        console.error('数据库初始化异常:', error)
        reject(error)
      }
    })
  }

  // 批量导入票价数据
  async importTickets(tickets) {
    if (!this.db) await this.init()

    // 提取所有唯一的站点
    const uniqueStations = new Set()
    tickets.forEach(ticket => {
      if (ticket.fromStation) uniqueStations.add(ticket.fromStation)
      if (ticket.toStation) uniqueStations.add(ticket.toStation)
    })

    // 批量导入站点数据（更快的方式）
    try {
      const stationTransaction = this.db.transaction([STORE_STATIONS], 'readwrite')
      const stationStore = stationTransaction.objectStore(STORE_STATIONS)
      
      const stationsToAdd = Array.from(uniqueStations).map(name => ({
        name,
        code: name.replace(/[^A-Z0-9]/g, '')
      }))

      // 批量添加站点，忽略重复错误
      stationsToAdd.forEach(station => {
        const request = stationStore.add(station)
        request.onerror = (e) => {
          // 忽略重复键错误（ConstraintError），这是正常的
          const error = e.target?.error
          if (error && error.name !== 'ConstraintError') {
            console.warn('添加站点失败:', station.name, error.message || error)
          }
        }
      })
      
      // 等待事务完成
      await new Promise(resolve => {
        stationTransaction.oncomplete = () => resolve()
        stationTransaction.onerror = () => resolve() // 即使有错误也继续
      })
      
      console.log(`已导入/更新站点数据`)
    } catch (error) {
      console.error('导入站点失败（可忽略）:', error)
    }

    // 分批导入票价数据
    const batchSize = 10000
    let count = 0
    const totalBatches = Math.ceil(tickets.length / batchSize)

    const importBatch = async (batchIndex) => {
      return new Promise((resolve, reject) => {
        // 为每个批次创建新的事务
        const batchTransaction = this.db.transaction([STORE_TICKETS], 'readwrite')
        const batchStore = batchTransaction.objectStore(STORE_TICKETS)
        
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, tickets.length)
        const batch = tickets.slice(start, end)

        let successCount = 0
        let errorCount = 0

        // 设置事务完成处理
        batchTransaction.oncomplete = () => {
          count += successCount
          console.log(`已导入 ${count} / ${tickets.length} 条数据`)
          
          if (batchIndex === totalBatches - 1) {
            resolve(count)
          } else {
            // 继续下一批
            setTimeout(() => {
              importBatch(batchIndex + 1).then(resolve).catch(reject)
            }, 50)
          }
        }

        // 设置事务错误处理（不中断整个导入）
        batchTransaction.onerror = (event) => {
          const error = event.target?.error
          if (error && error.name !== 'AbortError') {
            console.warn(`批次 ${batchIndex + 1} 事务错误:`, error)
          }
          // 即使有错误也继续下一批
          count += successCount
          if (batchIndex === totalBatches - 1) {
            resolve(count)
          } else {
            setTimeout(() => {
              importBatch(batchIndex + 1).then(resolve).catch(reject)
            }, 50)
          }
        }

        // 添加数据
        batch.forEach((ticket) => {
          const request = batchStore.add(ticket)
          
          request.onsuccess = () => {
            successCount++
          }
          
          request.onerror = (e) => {
            errorCount++
            // 只记录非重复键错误
            const error = e.target?.error
            if (error && error.name !== 'ConstraintError') {
              // 不输出警告，避免刷屏
            }
          }
        })
      })
    }

    // 开始导入
    return await importBatch(0)
  }

  // 批量导入站点数据
  async importStations(stations) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_STATIONS], 'readwrite')
      const store = transaction.objectStore(STORE_STATIONS)

      stations.forEach((station) => {
        store.add(station)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 根据起终点查询票价
  async searchTickets(fromStation, toStation, options = {}) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TICKETS], 'readonly')
      const store = transaction.objectStore(STORE_TICKETS)
      const index = store.index('fromStation')
      const request = index.openCursor(fromStation)

      const results = []
      const { limit = 1000, offset = 0 } = options
      let currentOffset = 0

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (!cursor) {
          resolve(results)
          return
        }

        const ticket = cursor.value
        if (ticket.toStation === toStation) {
          if (currentOffset >= offset && results.length < limit) {
            results.push(ticket)
          }
          currentOffset++
        }

        if (results.length < limit) {
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  // 根据车次查询
  async searchByTrainNumber(trainNumber) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TICKETS], 'readonly')
      const store = transaction.objectStore(STORE_TICKETS)
      const index = store.index('trainNumber')
      const request = index.openCursor(trainNumber)

      const results = []
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (!cursor) {
          resolve(results)
          return
        }
        results.push(cursor.value)
        cursor.continue()
      }

      request.onerror = () => reject(request.error)
    })
  }

  // 获取所有站点
  async getAllStations() {
    if (!this.db) await this.init()

    // 先尝试从站点表获取
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction([STORE_STATIONS], 'readonly')
      const store = transaction.objectStore(STORE_STATIONS)
      const request = store.getAll()

      request.onsuccess = async () => {
        const stations = request.result
        // 如果站点表为空或太少，从票价数据中提取并保存
        if (!stations || stations.length < 10) {
          console.log(`站点表只有 ${stations?.length || 0} 个站点，从票价数据中提取站点...`)
          const ticketStations = await this.extractStationsFromTickets()
          console.log(`成功提取并保存 ${ticketStations.length} 个站点`)
          resolve(ticketStations)
        } else {
          console.log(`从数据库读取了 ${stations.length} 个站点`)
          resolve(stations)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // 从票价数据中提取唯一站点并保存
  async extractStationsFromTickets() {
    if (!this.db) await this.init()

    return new Promise(async (resolve, reject) => {
      try {
        // 获取票价数据
        const transaction = this.db.transaction([STORE_TICKETS], 'readonly')
        const store = transaction.objectStore(STORE_TICKETS)
        const request = store.getAll()

        request.onsuccess = async () => {
          const tickets = request.result
          const uniqueStations = new Set()

          tickets.forEach(ticket => {
            if (ticket.fromStation) uniqueStations.add(ticket.fromStation)
            if (ticket.toStation) uniqueStations.add(ticket.toStation)
          })

          // 转换为站点对象数组
          const stations = Array.from(uniqueStations).map(name => ({
            name,
            code: name.replace(/[^A-Z0-9]/g, '')
          }))

          console.log(`从票价数据中提取了 ${stations.length} 个站点`)

          // 保存到站点表
          const stationTransaction = this.db.transaction([STORE_STATIONS], 'readwrite')
          const stationStore = stationTransaction.objectStore(STORE_STATIONS)

          stations.forEach(station => {
            stationStore.add(station).onerror = () => {} // 忽略重复错误
          })

          await new Promise((res) => {
            stationTransaction.oncomplete = () => res()
            stationTransaction.onerror = () => res()
          })

          console.log(`已保存 ${stations.length} 个站点到数据库`)
          resolve(stations)
        }

        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 获取数据统计
  async getStatistics() {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TICKETS], 'readonly')
      const store = transaction.objectStore(STORE_TICKETS)
      const request = store.count()

      request.onsuccess = () => {
        resolve({
          totalTickets: request.result
        })
      }
      request.onerror = () => reject(request.error)
    })
  }

  // 保存购票记录
  async savePurchase(purchaseData) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readwrite')
      const store = transaction.objectStore(STORE_PURCHASES)
      
      const purchase = {
        ...purchaseData,
        purchaseTime: new Date().toISOString(),
        timestamp: Date.now()
      }

      const request = store.add(purchase)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 获取所有购票记录
  async getAllPurchases() {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readonly')
      const store = transaction.objectStore(STORE_PURCHASES)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 根据参与者ID获取购票记录
  async getPurchasesByParticipant(participantId) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readonly')
      const store = transaction.objectStore(STORE_PURCHASES)
      const index = store.index('participantId')
      const request = index.getAll(participantId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 获取购票统计
  async getPurchaseStatistics() {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readonly')
      const store = transaction.objectStore(STORE_PURCHASES)
      const request = store.count()

      request.onsuccess = () => {
        resolve({
          totalPurchases: request.result
        })
      }
      request.onerror = () => reject(request.error)
    })
  }

  // 导出购票记录为JSON
  async exportPurchasesAsJSON() {
    const purchases = await this.getAllPurchases()
    return JSON.stringify(purchases, null, 2)
  }

  // 删除单条购票记录
  async deletePurchase(id) {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readwrite')
      const store = transaction.objectStore(STORE_PURCHASES)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 清空购票记录
  async clearPurchases() {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PURCHASES], 'readwrite')
      const store = transaction.objectStore(STORE_PURCHASES)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 保存问卷
  async saveSurvey(surveyData) {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SURVEYS], 'readwrite')
      const store = transaction.objectStore(STORE_SURVEYS)
      const data = {
        ...surveyData,
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      }
      const request = store.add(data)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 获取所有问卷
  async getAllSurveys() {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SURVEYS], 'readonly')
      const store = transaction.objectStore(STORE_SURVEYS)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async exportSurveysAsJSON() {
    const surveys = await this.getAllSurveys()
    return JSON.stringify(surveys, null, 2)
  }

  // 清空所有问卷数据
  async clearSurveys() {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SURVEYS], 'readwrite')
      const store = transaction.objectStore(STORE_SURVEYS)
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // 清空单个存储的辅助方法
  async _clearStore(storeName, storeLabel) {
    // 确保数据库连接有效
    if (!this.db) {
      await this.init()
    }

    if (!this.db) {
      throw new Error('数据库未初始化')
    }

    // 检查存储是否存在
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.warn(`存储 ${storeName} 不存在，跳过清空`)
      return
    }

    return new Promise((resolve, reject) => {
      try {
        // 创建事务
        const transaction = this.db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        
        let resolved = false
        
        // 设置事务完成处理（这是最可靠的方式）
        transaction.oncomplete = () => {
          if (!resolved) {
            resolved = true
            console.log(`${storeLabel}清空完成`)
            resolve()
          }
        }
        
        // 设置事务错误处理
        transaction.onerror = (event) => {
          if (!resolved) {
            resolved = true
            const error = event.target?.error || transaction.error
            console.error(`清空${storeLabel}事务错误:`, error)
            reject(error || new Error(`清空${storeLabel}失败`))
          }
        }
        
        // 设置事务中断处理
        transaction.onabort = () => {
          if (!resolved) {
            resolved = true
            console.error(`清空${storeLabel}事务被中断`)
            reject(new Error(`清空${storeLabel}操作被中断`))
          }
        }
        
        // 执行清空操作（必须在设置事件处理器之后）
        const request = store.clear()
        
        request.onsuccess = () => {
          // 请求成功，但需要等待事务完成
          // 不要在这里 resolve，等待 oncomplete
        }
        
        request.onerror = (event) => {
          if (!resolved) {
            resolved = true
            const error = event.target?.error
            console.error(`清空${storeLabel}请求错误:`, error)
            reject(error || new Error(`清空${storeLabel}请求失败`))
          }
        }
        
      } catch (error) {
        console.error(`清空${storeLabel}异常:`, error)
        reject(error)
      }
    })
  }

  // 清空数据（只清空票价数据和站点数据，不包括购票记录和问卷数据）
  async clearAll() {
    // 确保数据库连接有效
    if (!this.db || !this.db.objectStoreNames || this.db.objectStoreNames.length === 0) {
      await this.init()
    }

    // 再次检查连接
    if (!this.db || !this.db.objectStoreNames || this.db.objectStoreNames.length === 0) {
      throw new Error('数据库初始化失败，无法清空数据')
    }

    // 分别清空票价和站点数据，避免事务冲突
    try {
      // 清空票价数据
      await this._clearStore(STORE_TICKETS, '票价数据')
      
      // 清空站点数据
      await this._clearStore(STORE_STATIONS, '站点数据')

      console.log('票价和站点数据清空完成')
    } catch (error) {
      console.error('清空数据失败:', error)
      throw error
    }
  }
}

export default new DBManager()

