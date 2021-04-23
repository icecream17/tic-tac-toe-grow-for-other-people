/**
 * Utility function... so far only used once.
 * Checks if two arrays' _values_ are equal
 *
 * Will throw if the values are not strict equal and
 * one of the values is not an array
 *
 * @param {*[]} arr - An array to check
 * @return {boolean} - Whether the two arrays' values are equal
 * @example
 *
 *    valuesEqual([2, 3], [2, 3]) // true
 *    valuesEqual([2, 3], [2, 4]) // false
 *    valuesEqual([2, 4, [5]], [2, 4, [5]]) // true
 *    valuesEqual([2, 4, [5]], [2, 4, 5]) // false
 */
export function valuesEqual (arr1, arr2) {
   if (arr1 === arr2) {
      return true
   }

   if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
      console.error("One of the arguments don't pass Array.isArray: %o %o", arr1, arr2)
      throw new TypeError("One of the arguments don't pass Array.isArray")
   } else if (arr1.length !== arr2.length) {
      return false
   }

   for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
         if (!Array.isArray(arr1[i]) || !Array.isArray(arr2[i]) || !valuesEqual(arr1[i], arr2[i])) {
            return false
         }
      }
   }
   return true
}
