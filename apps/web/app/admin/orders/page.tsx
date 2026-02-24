'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusLabel, getStatusColor } from '@/lib/utils';

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data } = await apiClient.getAdminOrders(filter === 'ALL' ? undefined : filter);
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">어드민 주문 목록</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/intake"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              접수함
            </Link>
          </div>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded ${filter === 'ALL' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter(OrderStatus.SUBMITTED)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.SUBMITTED ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            접수됨
          </button>
          <button
            onClick={() => setFilter(OrderStatus.GENERATED)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.GENERATED ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            생성 완료
          </button>
          <button
            onClick={() => setFilter(OrderStatus.ADMIN_REVIEW)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.ADMIN_REVIEW ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            어드민 검수
          </button>
          <button
            onClick={() => setFilter(OrderStatus.AGENCY_REVIEW)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.AGENCY_REVIEW ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            대행사 검수
          </button>
          <button
            onClick={() => setFilter(OrderStatus.COMPLETE)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.COMPLETE ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            주문완료
          </button>
          <button
            onClick={() => setFilter(OrderStatus.CANCELED)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.CANCELED ? 'bg-red-500 text-white' : 'bg-white'}`}
          >
            취소됨
          </button>
          <button
            onClick={() => setFilter(OrderStatus.CANCEL_REQUESTED)}
            className={`px-4 py-2 rounded ${filter === OrderStatus.CANCEL_REQUESTED ? 'bg-orange-500 text-white' : 'bg-white'}`}
          >
            취소 요청됨
          </button>
        </div>

        {loading ? (
          <div>로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-8 rounded shadow text-center text-gray-500">
            주문이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block bg-white p-6 rounded shadow hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">{order.placeName}</h2>
                    <p className="text-gray-600 text-sm">
                      {order.placeAddress}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(order.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





