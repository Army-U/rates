import React, { useMemo, useState, useCallback } from 'react'
import { Table, Select, Form, Modal } from 'antd'
import Trend from 'react-trend'
import { connect } from 'react-redux'
import { TableProps } from 'antd/lib/table'
import qs from 'query-string'
import useSWR from 'swr'

import { SettingsStore } from '@/store'
import random from '@/utils/random'
import { getPast30Days } from '@/utils/date'
import { CURRENCIES } from '@/constants'
import Conversion from './conversion'
import './index.scss'

const { start_at, end_at } = getPast30Days()

const DEFAULT_SELECTED_CURRENCY = { symbol: '', rate: 0 }

export default connect(state => state)(function Home(
  props: SettingsStore & any
) {
  const defaultCurrency = props.source
  const [selectedCurreny, setSelectedCurreny] = useState(
    DEFAULT_SELECTED_CURRENCY
  )
  const [form] = Form.useForm()

  const { data } = useSWR<Rates>(
    '/history?' +
      qs.stringify({
        start_at,
        end_at,
        base: defaultCurrency
      }),
    { refreshInterval: props.period, suspense: true }
  )

  const dateRange = data?.rates
    ? Object.keys(data?.rates)
        .sort()
        .reverse()
    : new Array(30).fill(null)

  const columns: TableProps<any>['columns'] = useMemo(() => {
    return [
      {
        key: 'currency',
        title: 'Currency',
        dataIndex: 'currency',
        width: 95,
        fixed: 'left'
      },
      {
        key: 'chart',
        title: 'Chart',
        width: 150,
        height: 60,
        fixed: 'left',
        render(text, record) {
          if (!data?.rates) return null
          return (
            <Trend
              padding={0}
              height={60}
              smooth
              data={dateRange.map(v => record[v])}
            />
          )
        }
      },
      ...dateRange.map(key => ({
        key,
        width: 100,
        title: key.replace(/^\d+-/, ''),
        dataIndex: key
      }))
    ]
  }, [data, data?.rates, dateRange])

  const tableSource = useMemo(() => {
    return props.currencies
      .filter(v => v !== defaultCurrency)
      .map(currency => {
        return {
          key: currency,
          currency,
          ...dateRange.reduce((sum, date) => {
            return Object.assign(sum, {
              [date]: random(data?.rates[date][currency])
            })
          }, {})
        }
      })
  }, [data?.rates])

  const onConversionModalClosed = useCallback(() => {
    setSelectedCurreny(DEFAULT_SELECTED_CURRENCY)
  }, [])

  return (
    <div className="home">
      <Form
        initialValues={{ source: defaultCurrency }}
        form={form}
        onValuesChange={(changedValues, allValues) => {
          props.dispatch({
            type: 'ALTER',
            state: { source: allValues.source }
          })
        }}
      >
        <Form.Item name="source" label="Source">
          <Select showSearch style={{ width: 100 }}>
            {CURRENCIES.map(currency => (
              <Select.Option key={currency} value={currency}>
                {currency}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <Table
        onRow={(
          record: Record<string, string | number> & { currency: string }
        ) => {
          return {
            onClick: () => {
              setSelectedCurreny({
                symbol: record.currency,
                rate: record[dateRange[0]] as number
              })
            }
          }
        }}
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={tableSource}
        pagination={false}
        sticky
      />

      <Modal
        onOk={onConversionModalClosed}
        onCancel={onConversionModalClosed}
        title="Conversion"
        visible={Boolean(selectedCurreny.symbol)}
        destroyOnClose
      >
        <Conversion
          symbol={selectedCurreny.symbol}
          rate={selectedCurreny.rate}
        />
      </Modal>
    </div>
  )
})

export interface Rates {
  rates: Record<string, string>
  start_at: string
  base: string
  end_at: string
}
