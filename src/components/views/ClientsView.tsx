import React, { useState } from 'react';
import { useOpsStore } from '../../store/opsStore';
import { ClientVendor } from '../../types';
import { 
  Building2, Users, Plus, Mail, Phone, ShieldCheck, 
  Search, ExternalLink, Trash2, Edit3, DollarSign, 
  CheckCircle2, Clock, AlertTriangle, ArrowUpRight 
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const ClientsView: React.FC = () => {
  const clientsVendors = useOpsStore((state) => state.clientsVendors);
  const createClientVendor = useOpsStore((state) => state.createClientVendor);
  const deleteClientVendor = useOpsStore((state) => state.deleteClientVendor);
  const tasks = useOpsStore((state) => state.tasks);
  const setCreateTaskModalOpen = useOpsStore((state) => state.setCreateTaskModalOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'client' | 'vendor' | 'partner'>('client');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slaTier, setSlaTier] = useState('Platinum (99.9% SLA)');
  const [monthlyValue, setMonthlyValue] = useState('$35,000/mo');
  const [notes, setNotes] = useState('');

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createClientVendor({
      name: name.trim(),
      type,
      contactPerson: contactPerson.trim() || 'Key Account Manager',
      email: email.trim() || 'contact@client.com',
      phone: phone.trim() || '+1 (555) 000-0000',
      slaTier,
      status: 'active',
      activeContracts: 1,
      monthlyValue: monthlyValue || '$10,000/mo',
      notes: notes.trim() || 'Client managed by Faseeh Lall & Co.'
    });

    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const filteredClients = clientsVendors.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.contactPerson.toLowerCase().includes(q) ||
      c.slaTier.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Clients & Enterprise Accounts
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              {clientsVendors.filter(c => c.type === 'client').length} Active Accounts
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage your marketing & operations clients, assign dedicated tasks, track SLAs, and monitor monthly retainer contracts.
          </p>
        </div>

        {/* Primary Add Client Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Client</span>
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-gray-400">Total Clients</div>
            <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-0.5">
              {clientsVendors.length}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> 100% Active Retainers
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-gray-400">Active Client Tasks</div>
            <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-0.5">
              {tasks.filter(t => Boolean(t.customFields?.clientName)).length}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" /> In Execution Pipeline
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-gray-400">SLA Health Score</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              99.4%
            </div>
            <div className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> Platinum Tier Adherence
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-gray-400">Retainer Value</div>
            <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-0.5">
              $148.5k<span className="text-xs text-gray-400 font-normal">/mo</span>
            </div>
            <div className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Active Marketing MRR
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients by name, contact person, or SLA..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClients.map((client) => {
          const clientTasks = tasks.filter(
            (t) => t.customFields?.clientName?.toLowerCase() === client.name.toLowerCase()
          );

          return (
            <div
              key={client.id}
              className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm border border-brand-500/20">
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {client.name}
                      </h3>
                      <div className="text-xs text-gray-500">{client.contactPerson}</div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
                    {client.slaTier}
                  </span>
                </div>

                {/* Notes & Description */}
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
                  {client.notes}
                </p>

                {/* Active Tasks Widget */}
                <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-100 dark:border-dark-border/60">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-brand-500" />
                      <span>Client Tasks ({clientTasks.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreateTaskModalOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-brand-500 hover:text-brand-600"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Task</span>
                    </button>
                  </div>

                  {clientTasks.length > 0 ? (
                    <div className="space-y-1.5">
                      {clientTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border/40"
                        >
                          <span className="truncate max-w-[160px] text-gray-800 dark:text-gray-200 font-medium">
                            {t.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/10 text-brand-600">
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">No tasks currently assigned</div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-[11px]">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-[11px]">{client.phone}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border/60 flex items-center justify-between text-xs">
                <span className="font-black text-brand-600 dark:text-brand-400">
                  {client.monthlyValue}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${client.name} from client list?`)) {
                      deleteClientVendor(client.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 text-[11px] transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Client Account"
        maxWidth="md"
      >
        <form onSubmit={handleCreateClient} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Client / Company Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Global Logistics"
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Account Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="client">Client (Marketing Retainer)</option>
                <option value="partner">Enterprise Partner</option>
                <option value="vendor">Vendor / Supplier</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. David Miller (VP Ops)"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@client.com"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 234-8900"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                SLA Tier
              </label>
              <select
                value={slaTier}
                onChange={(e) => setSlaTier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Platinum (99.9% SLA)">Platinum (99.9% SLA)</option>
                <option value="Gold (99.5% SLA)">Gold (99.5% SLA)</option>
                <option value="Silver (98.0% SLA)">Silver (98.0% SLA)</option>
                <option value="Standard Operations">Standard Operations</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Monthly Retainer Value
              </label>
              <input
                type="text"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                placeholder="e.g. $35,000/mo"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              Account Notes & Key Requirements
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational instructions, delivery milestones, client guidelines..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-border text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/25"
            >
              Save Client Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
