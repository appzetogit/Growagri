import React, { useState, useEffect } from 'react';
import { FiAward, FiPackage, FiBarChart2, FiDollarSign, FiLoader } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import adminReportService from '../../../../services/adminReportService';

const BAR_COLOR = '#3B82F6';
const RANK_STYLES = ['bg-amber-100 text-amber-700', 'bg-gray-200 text-gray-700', 'bg-orange-100 text-orange-700'];
const rupees = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const shorten = (s) => (s && s.length > 16 ? `${s.slice(0, 15)}…` : s);

const Empty = () => <p className="py-8 text-center text-xs text-gray-500">No bookings yet</p>;

// Horizontal single-series bar chart; height grows with the number of rows
const RankChart = ({ data, dataKey, nameKey, format = (v) => v, tooltipLabel }) => {
  if (!data.length) return <Empty />;
  return (
    <div style={{ height: Math.max(140, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" allowDecimals={false} tickFormatter={format} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis dataKey={nameKey} type="category" width={110} tickFormatter={shorten} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            formatter={(v) => [format(v), tooltipLabel]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipTitle || label}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey={dataKey} fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const OwnerAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await adminReportService.getVendorReport();
        if (res.success) setData(res.data);
      } catch (error) {
        console.error('Owner analytics error:', error);
        toast.error('Failed to load owner analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const owners = (data.vendorRanking || []).map(o => ({
    ...o,
    label: o.businessName || o.name || 'Unknown owner',
    tooltipTitle: o.businessName || o.name || 'Unknown owner'
  }));
  const earners = [...owners].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const equipment = (data.topEquipment || []).map(e => ({
    ...e,
    label: e.name || e.serviceName || 'Equipment',
    tooltipTitle: `${e.name || e.serviceName || 'Equipment'} (${e.ownerName || 'Unknown owner'})`
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell icon={FiBarChart2} title="Bookings by Owner" subtitle="Who gets the most orders">
          <RankChart data={owners} dataKey="bookingCount" nameKey="label" tooltipLabel="Bookings" />
        </CardShell>

        <CardShell icon={FiPackage} title="Most Booked Equipment" subtitle="Which owner's equipment is in demand">
          <RankChart data={equipment} dataKey="bookingCount" nameKey="label" tooltipLabel="Bookings" />
        </CardShell>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell icon={FiDollarSign} title="Earnings by Owner" subtitle="From completed bookings">
          <RankChart data={earners} dataKey="totalRevenue" nameKey="label" format={rupees} tooltipLabel="Earned" />
        </CardShell>

        <CardShell icon={FiAward} title="Owner Leaderboard" subtitle="Ranked by number of bookings">
          {owners.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="py-2 pr-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="py-2 pr-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Bookings</th>
                    <th className="py-2 pr-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Completed</th>
                    <th className="py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {owners.map((o, i) => (
                    <tr key={o._id}>
                      <td className="py-2 pr-2">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-bold ${RANK_STYLES[i] || 'bg-blue-50 text-blue-600'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs font-semibold text-gray-900">{o.label}</td>
                      <td className="py-2 pr-2 text-xs font-bold text-gray-900 text-right">{o.bookingCount}</td>
                      <td className="py-2 pr-2 text-xs text-gray-600 text-right">{o.completedCount}</td>
                      <td className="py-2 text-xs text-gray-600 text-right">{rupees(o.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardShell>
      </div>
    </div>
  );
};

export default OwnerAnalytics;
