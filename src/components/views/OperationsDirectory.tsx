import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { ClientVendor } from '../../types';
import { 
  Users, Building2, ShieldCheck, Mail, Phone, 
  Plus, CheckCircle, Clock, Search, FileText 
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const OperationsDirectory: React.FC = () => {
  const users = useOpsStore((state) => state.users);
  const tasks = useOpsStore((state) => state.tasks);
  const clientsVendors = useOpsStore((state) => state.clientsVendors);
  const createClientVendor = useOpsStore((state) => state.createClientVendor);
  const deleteClientVendor = useOpsStore((state) => state.deleteClientVendor);

  const [activeTab, setActiveTab] = useState<'team' | 'clients'>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Client/Vendor Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'client' | 'vendor' | 'partner'>('client');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slaTier, setSlaTier] = useState('Platinum (99.9%)');
  const [monthlyValue, setMonthlyValue] = useState('$25,000/mo');
  const [notes, setNotes] = useState('');

  const handleCreateClientVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createClientVendor({
      name: name.trim(),
      type,
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      slaTier,
      status: 'active',
      activeContracts: 1,
      monthlyValue,
      notes: notes.trim()
    });
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setIsAddModalOpen(false);
  };

  const filteredTeam = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.department.toLowerCase().includes(q);
  });

  const filteredClients = clientsVendors.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q) || c.slaTier.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-dark-border">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-500" />
            <span>Operations & SLA Directory</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Operational personnel hierarchy, enterprise clients, vendors, and SLA contracts
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-gray-100 dark:bg-dark-200 rounded-xl border border-gray-200 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'team'
                  ? 'bg-white dark:bg-dark-300 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ops Team ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clients')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'clients'
                  ? 'bg-white dark:bg-dark-300 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Clients & Vendors ({clientsVendors.length})</span>
            </button>
          </div>

          {activeTab === 'clients' && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 px-3.5 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 shadow-md shadow-brand-500/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Partner</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeTab === 'team' ? 'team members or roles' : 'clients, vendors or SLA tiers'}...`}
          className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
        />
      </div>

      {/* TAB: TEAM */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeam.map((u) => {
            const userTasks = tasks.filter((t) => t.assigneeIds.includes(u.id));
            const activeTasksCount = userTasks.filter((t) => t.status !== 'completed').length;
            const completedCount = userTasks.filter((t) => t.status === 'completed').length;

            return (
              <div
                key={u.id}
                className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-2xl object-cover" />
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              u.status === 'online' ? 'bg-emerald-500' : u.status === 'busy' ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                          />
                        </h4>
                        <div className="text-xs font-semibold text-brand-600 dark:text-brand-400">{u.role}</div>
                        <div className="text-[11px] text-gray-400">{u.department}</div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-400">
                      {u.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Workload:</span>
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-blue-500">{activeTasksCount} Active</span>
                    <span>•</span>
                    <span className="text-emerald-500">{completedCount} Done</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: CLIENTS & VENDORS */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((cv) => (
            <div
              key={cv.id}
              className="p-5 rounded-2xl bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{cv.name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          cv.type === 'client'
                            ? 'bg-blue-500/10 text-blue-500'
                            : cv.type === 'vendor'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        {cv.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{cv.contactPerson}</div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {cv.slaTier}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
                  {cv.notes}
                </p>

                {/* Client Active Tasks Count */}
                {(() => {
                  const clientTasks = tasks.filter(
                    (t) => t.customFields?.clientName?.toLowerCase() === cv.name.toLowerCase()
                  );
                  return (
                    <div className="mt-3 p-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-100 dark:border-dark-border/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Active Tasks ({clientTasks.length})
                        </span>
                        {clientTasks.some((t) => t.priority === 'urgent') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 animate-pulse">
                            Urgent SLA
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          useOpsStore.getState().setCreateTaskModalOpen(true);
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-brand-500 hover:text-brand-600"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Task</span>
                      </button>
                    </div>
                  );
                })()}

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{cv.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{cv.phone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 flex items-center justify-between text-xs">
                <span className="font-semibold text-brand-600 dark:text-brand-400">{cv.monthlyValue}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${cv.name} from directory?`)) {
                      deleteClientVendor(cv.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 text-[11px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client / Vendor Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Partner / Client"
        maxWidth="md"
      >
        <form onSubmit={handleCreateClientVendor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Company / Organization Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Global Logistics"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Partner Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
              >
                <option value="client">Client</option>
                <option value="vendor">Vendor / Supplier</option>
                <option value="partner">Logistics Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">SLA Tier</label>
              <select
                value={slaTier}
                onChange={(e) => setSlaTier(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
              >
                <option value="Platinum (99.9%)">Platinum (99.9%)</option>
                <option value="Gold (99.5%)">Gold (99.5%)</option>
                <option value="Silver (99.0%)">Silver (99.0%)</option>
                <option value="Standard">Standard Tier</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Primary Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. David Miller (VP Ops)"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Contract / Operating Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key SLA deliverables and contract details..."
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 shadow"
            >
              Save Partner
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
