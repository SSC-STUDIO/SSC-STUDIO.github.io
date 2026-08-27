import Emitter from './Emitter'

import { gsap } from 'gsap/gsap-core'

class Ticker {
  /**
   * Constructor
   */
  constructor () {
    this.callbacks = []

    this.delta = 0
  }

  /**
   * Init
   */
  init () {
    gsap.ticker.add(this.tick.bind(this))
  }

  /**
   * Tick
   */
  tick(time, delta) {
    const self = this

    this.delta = delta

    this.callbacks.forEach((object, index) => {
      try {
        object.callback.apply(object.context)
      } catch (error) {
        console.error('[Ticker] nextTick callback failed:', error)
      }

      delete self.callbacks[index]
    })

    Emitter.emit('tick', time * 1000)
  }

  /**
   * Next tick
   */
  nextTick (callback, context) {
    this.callbacks.push({
      callback,
      context
    })
  }
}

export default new Ticker()
