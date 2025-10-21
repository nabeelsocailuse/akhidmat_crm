import { createResource } from 'frappe-ui'
import { formatCurrency, formatNumber } from '@/utils/numberFormat.js'
import { reactive } from 'vue'
import { call } from '@/utils/api'

const doctypeMeta = reactive({})
const userSettings = reactive({})
// Shared cache for backend Currency.symbol values. Keyed by currency code.
const currencySymbols = reactive({})

async function fetchBackendCurrencySymbol(code) {
  if (!code) return null
  // If symbol already cached (including explicit null/false), return it
  if (Object.prototype.hasOwnProperty.call(currencySymbols, code)) {
    return currencySymbols[code]
  }

  // mark as fetching (null) to avoid duplicate calls
  currencySymbols[code] = null
  try {
    const res = await call('frappe.client.get_value', {
      doctype: 'Currency',
      filters: { name: code },
      fieldname: 'symbol',
    })

    const symbol = res?.message?.symbol || res?.symbol || null
    // store symbol (may be null)
    currencySymbols[code] = symbol || false
    return currencySymbols[code]
  } catch (e) {
    // on error, store false to avoid retry storms
    currencySymbols[code] = false
    return null
  }
}

export function getMeta(doctype) {
  const meta = createResource({
    url: 'frappe.desk.form.load.getdoctype',
    params: {
      doctype: doctype,
      with_parent: 1,
      cached_timestamp: null,
    },
    cache: ['Meta', doctype],
    onSuccess: (res) => {
      let dtMetas = res.docs
      for (let dtMeta of dtMetas) {
        doctypeMeta[dtMeta.name] = dtMeta
      }

      userSettings[doctype] = JSON.parse(res.user_settings)
    },
  })

  if (!doctypeMeta[doctype] && !meta.loading) {
    meta.fetch()
  }

  function getFormattedPercent(fieldname, doc) {
    let value = getFormattedFloat(fieldname, doc)
    return value + '%'
  }

  function getFormattedFloat(fieldname, doc) {
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null
    return formatNumber(doc[fieldname], '', precision)
  }

  function getFloatWithPrecision(fieldname, doc) {
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null
    return formatNumber(doc[fieldname], '', precision)
  }

  function getCurrencyWithPrecision(fieldname, doc) {
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null
    return formatCurrency(doc[fieldname], '', '', precision)
  }

  function getFormattedCurrency(fieldname, doc, parentDoc = null) {
    let currency = window.sysdefaults.currency || 'USD'
    let df = doctypeMeta[doctype]?.fields.find((f) => f.fieldname == fieldname)
    let precision = df?.precision || null

    if (df && df.options) {
      if (df.options.indexOf(':') != -1) {
        currency = currency
        // TODO: Handle this case
      } else if (doc && doc[df.options]) {
        currency = doc[df.options]
      } else if (parentDoc && parentDoc[df.options]) {
        currency = parentDoc[df.options]
      }
    }

    const value = doc[fieldname]

    // If we have a cached backend symbol, prefer it
    const cached = currencySymbols[currency]
    if (cached && typeof cached === 'string') {
      // Use formatNumber for numeric formatting and prefix with backend symbol
      return `${cached} ${formatNumber(value, '', precision)}`
    }

    // If not cached yet (undefined), fetch in background and fall back to util
    if (cached === undefined) {
      // fire-and-forget
      fetchBackendCurrencySymbol(currency).catch(() => {})
    }

    // Fallback: use existing util which relies on Intl
    return formatCurrency(value, '', currency, precision)
  }

  function getGridSettings() {
    return doctypeMeta[doctype] || {}
  }

  function getGridViewSettings(parentDoctype, dt = null) {
    dt = dt || doctype
    if (!userSettings[parentDoctype]?.['GridView']?.[doctype]) return {}
    return userSettings[parentDoctype]['GridView'][doctype]
  }

  function getFields(dt = null) {
    dt = dt || doctype
    return doctypeMeta[dt]?.fields.map((f) => {
      if (f.fieldtype === 'Select' && typeof f.options === 'string') {
        f.options = f.options.split('\n').map((option) => {
          return {
            label: option,
            value: option,
          }
        })

        if (f.options[0]?.value !== '') {
          f.options.unshift({
            label: '',
            value: '',
          })
        }
      }
      if (f.fieldtype === 'Link' && f.options == 'User') {
        f.fieldtype = 'User'
      }
      return f
    })
  }

  function saveUserSettings(parentDoctype, key, value, callback) {
    let oldUserSettings = userSettings[parentDoctype] || {}
    let newUserSettings = JSON.parse(JSON.stringify(oldUserSettings))

    if (newUserSettings[key] === undefined) {
      newUserSettings[key] = { [doctype]: value }
    } else {
      newUserSettings[key][doctype] = value
    }

    if (JSON.stringify(oldUserSettings) !== JSON.stringify(newUserSettings)) {
      return createResource({
        url: 'frappe.model.utils.user_settings.save',
        params: {
          doctype: parentDoctype,
          user_settings: JSON.stringify(newUserSettings),
        },
        auto: true,
        onSuccess: () => {
          userSettings[parentDoctype] = newUserSettings
          callback?.()
        },
      })
    }
    userSettings[parentDoctype] = newUserSettings
    return callback?.()
  }

  return {
    meta,
    doctypeMeta,
    userSettings,
    getFields,
    getGridSettings,
    getGridViewSettings,
    saveUserSettings,
    getFloatWithPrecision,
    getCurrencyWithPrecision,
    getFormattedFloat,
    getFormattedPercent,
    getFormattedCurrency,
  }
}
