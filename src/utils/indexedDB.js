/**
 * IndexedDB 数据库管理
 * 用于存储和检索千万级高铁票价数据
 */

const DB_NAME = 'TrainTicketDB'
const DB_VERSION = 2
const STORE_TICKETS = 'tickets'
const STORE_STATIONS = 'stations'
const STORE_ROUTES = 'routes'
const STORE_PURCHASES = 'purchases' // 购票记录表

class DBManager {
  constructor() {
    this.db = null
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
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
      }
    })
  }

  // 批量导入票价数据
  async importTickets(tickets) {
    if (!this.db) await this.init()

    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction([STORE_TICKETS], 'readwrite')
      const store = transaction.objectStore(STORE_TICKETS)
      const batchSize = 10000 // 分批处理，每批10000条

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
          stationStore.add(station).onerror = () => {} // 忽略重复错误
        })
        
        // 等待事务完成
        await new Promise(resolve => {
          stationTransaction.oncomplete = () => resolve()
          stationTransaction.onerror = () => resolve()
        })
        
        console.log(`已导入/更新站点数据`)
      } catch (error) {
        console.error('导入站点失败（可忽略）:', error)
      }

      let count = 0
      const totalBatches = Math.ceil(tickets.length / batchSize)

      const importBatch = async (batchIndex) => {
        // 为每个批次创建新的事务
        const batchTransaction = this.db.transaction([STORE_TICKETS], 'readwrite')
        const batchStore = batchTransaction.objectStore(STORE_TICKETS)
        
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, tickets.length)
        const batch = tickets.slice(start, end)

        return new Promise((res, rej) => {
          let completedInBatch = 0

          batch.forEach((ticket, idx) => {
            const request = batchStore.add(ticket)
            request.onerror = (e) => {
              console.error('导入失败:', ticket.trainNumber, e)
            }

            request.onsuccess = () => {
              completedInBatch++
              if (completedInBatch === batch.length) {
                count += batch.length
                console.log(`已导入 ${count} / ${tickets.length} 条数据`)
                
                if (batchIndex === totalBatches - 1) {
                  resolve(count)
                } else {
                  res()
                }
              }
            }
          })
        }).then(() => {
          // 继续下一批
          if (batchIndex < totalBatches - 1) {
            return new Promise(r => setTimeout(() => {
              importBatch(batchIndex + 1).then(() => r())
            }, 50))
          }
        })
      }

      transaction.onerror = () => reject(transaction.error)
      
      // 导入票价数据
      importBatch(0)
    })
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

  // 清空数据
  async clearAll() {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TICKETS, STORE_STATIONS], 'readwrite')
      const ticketStore = transaction.objectStore(STORE_TICKETS)
      const stationStore = transaction.objectStore(STORE_STATIONS)

      const ticketRequest = ticketStore.clear()
      const stationRequest = stationStore.clear()

      Promise.all([
        new Promise((res) => {
          ticketRequest.onsuccess = () => res()
          ticketRequest.onerror = () => reject(ticketRequest.error)
        }),
        new Promise((res) => {
          stationRequest.onsuccess = () => res()
          stationRequest.onerror = () => reject(stationRequest.error)
        })
      ]).then(() => resolve())
    })
  }
}

export default new DBManager()

