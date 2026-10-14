import React, { useState, useEffect } from 'react';
import { FiPieChart, FiTrendingUp, FiLoader } from 'react-icons/fi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import adminReportService from '../../../../services/adminReportService';

const FarmerAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Reusing vendor report endpoint for now if user report isn't specific, 
      // but ideally we should have getCustomerReport
      const res = await adminReportService.getCustomerReport();
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Farmer analytics error:', error);
      toast.error('Failed to load farmer analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Verification Status Distribution */}
        <CardShell icon={FiPieChart} title="Farmer Verification" className="p-3">
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.verificationStatus}
                  dataKey="count"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                >
                  {data.verificationStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardShell>

        {/* Top Users by Spending */}
        <CardShell icon={FiTrendingUp} title="Top Farmers" className="p-3">
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topUsers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="bookingCount" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      </div>

      {/* Monthly User Registration Trend */}
      <CardShell icon={FiTrendingUp} title="Farmer Registration Trend" className="p-3">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorTrend)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardShell>
    </div>
  );
};

export default FarmerAnalytics;
