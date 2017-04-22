'use strict'
const deepEqual = require('deep-equal')


const bool = o => !!o

const isPut = obj => bool(obj && Object.keys(obj).includes('PUT'))

const isNestedPut = arr => bool(
  arr &&
  arr.every &&
  arr.length > 0 &&
  arr.every(element => isPut(element))
)

const isNestedArray = arr => bool(
  arr &&
  arr.every && // Is an array
  arr.every(subArr => subArr.length === 2) // Every array inside has exactly 2 elements.
)

const isMap = m => bool(Object.prototype.toString.call(m) === '[object Map]')

// Lifted from https://github.com/tj/co/blob/717b043371ba057cb7a4a2a4e47120d598116ed7/index.js#L221
function isGeneratorFunction(obj) {
  const { constructor } = (obj || {})
  if (!constructor) return false
  if (
    'GeneratorFunction' === constructor.name ||
    'GeneratorFunction' === constructor.displayName
  ) {
    return true
  }
  return false
}

function assert(condition, message) {
  if (!condition) {
    if (typeof Error !== 'undefined') {
      throw new Error(message || 'Assertion failed')
    }
  }
}

// Returns value in mapping corresponding to matching searchVal key.
function getNextVal(searchVal, mapping) {
  if (isMap(mapping)) {
    for (let [key, value] of mapping.entries()) {
      if (deepEqual(key, searchVal)) {
        return value
      }
    }
  } else {
    return (mapping.find(keyVal => deepEqual(keyVal[0], searchVal)) || [])[1]
  }
}

// Used to stringify yielded values. Output includes functions
function stringifyVal(val) {
  return JSON.stringify(val, (key, val) => {
    if (typeof val === 'function') {
      if (val.name) {
        return `[Function: ${val.name}]: ${val.toString()}`
      } else {
        return `[Function]: ${val.toString()}`
      }
    }
    return val
  }, 2)
}

function sagaTestEngine(genFunc, envMapping, ...initialArgs) {
  assert(
    isGeneratorFunction(genFunc),
    'The first parameter must be a generator function.')
  assert(
    isMap(envMapping) || isNestedArray(envMapping),
    'The second parameter must be a nested array or Map.')

  const mapping = [...envMapping, [undefined, undefined]]
  const gen = genFunc(...initialArgs)
  let val = undefined
  let puts = []
  let isDone = false
  let counter = 0

  while (!isDone) {
    const nextVal = getNextVal(val, mapping)

    // Yielded value must appear in mapping, or be a PUT Effect.
    const isFirstLoop = counter === 0
    const nextValFound = nextVal !== undefined
    const yieldedUndefined = val === undefined
    const yieldedEffectIsPut = isPut(val) || isNestedPut(val)
    assert(
      (isFirstLoop || nextValFound || yieldedUndefined || yieldedEffectIsPut),
      `Env Mapping is missing a value for ${stringifyVal(val)}`)

    const genResult = gen.next(nextVal)

    val = genResult.value
    isDone = genResult.done

    if (isPut(val) || isNestedPut(val)) {
      puts.push(val)
    }
    counter++
  }
  return puts
}

module.exports = { sagaTestEngine, isPut, isNestedPut, isNestedArray, getNextVal, assert }
