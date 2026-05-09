"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Database, Shield, Brain, Terminal, Server, 
  MessageSquare, AlertTriangle, Blocks, Workflow, 
  Lock, Eye, MessageCircle 
} from 'lucide-react';

const DiagramBlock = ({ children, isTall = true }) => (
  <div className="relative group">
    {/* The Blue Offset Shadow */}
    <div className="absolute inset-0 bg-blue-500 rounded-[2rem] translate-x-2 translate-y-2 opacity-40 blur-[2px]"></div>
    
    <div className={`relative w-[160px] h-[400px] bg-white rounded-[2rem] border border-gray-200 flex flex-col items-center justify-evenly p-6 shadow-xl z-10 overflow-hidden transition-transform duration-300 group-hover:-translate-y-1`}>
      {children}
    </div>
  </div>
);

const Node = ({ icon: Icon, title, colorClass, subtitle }) => (
  <div className="flex flex-col items-center justify-center w-full">
    <Icon className={`w-10 h-10 ${colorClass} mb-2`} />
    {title && <span className="text-[11px] font-extrabold text-gray-800 text-center leading-tight uppercase tracking-tighter">{title}</span>}
    {subtitle && <span className="text-[10px] font-bold text-gray-400 text-center leading-tight uppercase tracking-widest mt-1">{subtitle}</span>}
  </div>
);

const ConnectionLines = () => (
  <div className="relative w-16 h-[400px] flex flex-col justify-evenly items-center opacity-30">
    {[0, 1, 2].map((i) => (
      <div key={i} className="relative w-full h-px bg-gray-500 border-t border-dashed border-gray-400">
        <motion.div
          className="absolute top-[-2px] w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]"
          initial={{ left: "-10%" }}
          animate={{ left: "110%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
            delay: i * 0.6,
          }}
        />
      </div>
    ))}
  </div>
);

export default function ArchitectureDiagram() {
  return (
    <section className="w-full py-32 bg-[#050A15] flex flex-col items-center overflow-hidden">
      {/* Title */}
      <h2 className="text-3xl md:text-5xl font-black text-white mb-24 tracking-tight">
        The Data Command Graph
      </h2>

      <div className="flex flex-wrap justify-center items-end gap-2 md:gap-4 px-4 max-w-7xl mx-auto">
        
        {/* 1. Vector DBs */}
        <div className="flex flex-col items-center gap-6">
          <DiagramBlock>
            <Node icon={Database} colorClass="text-emerald-500" />
            <Node icon={Server} colorClass="text-blue-500" />
            <Node icon={Blocks} colorClass="text-red-500" />
          </DiagramBlock>
          <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase">Vector DBs</span>
        </div>

        <ConnectionLines />

        {/* 2. Retrieval Firewall */}
        <div className="flex flex-col items-center gap-6">
          <DiagramBlock>
            <div className="flex flex-col items-center">
              <Shield className="w-16 h-16 text-blue-500 mb-4" />
              <span className="text-sm font-black text-gray-800 text-center leading-tight">Retrieval<br />Firewall</span>
            </div>
          </DiagramBlock>
          <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase">Retrieval Firewall</span>
        </div>

        <ConnectionLines />

        {/* 3. AI Models */}
        <div className="flex flex-col items-center gap-6">
          <DiagramBlock>
            <Node icon={Brain} colorClass="text-purple-500" />
            <Node icon={Workflow} colorClass="text-gray-400" />
            <Node icon={Eye} colorClass="text-green-500" />
          </DiagramBlock>
          <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase">AI Models</span>
        </div>

        <ConnectionLines />

        {/* 4. Policy Firewalls */}
        <div className="flex flex-col items-center gap-6">
          <DiagramBlock>
            <div className="flex flex-col items-center gap-12">
              <div className="flex flex-col items-center">
                <MessageSquare className="w-10 h-10 text-cyan-500 mb-2" />
                <span className="text-[11px] font-black text-gray-800 text-center uppercase tracking-tighter">Prompt<br />Firewall</span>
              </div>
              <div className="flex flex-col items-center">
                <AlertTriangle className="w-10 h-10 text-green-500 mb-2" />
                <span className="text-[11px] font-black text-gray-800 text-center uppercase tracking-tighter">Response<br />Firewall</span>
              </div>
            </div>
          </DiagramBlock>
          <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase">Policy Firewalls</span>
        </div>

        <ConnectionLines />

        {/* 5. Endpoints */}
        <div className="flex flex-col items-center gap-6">
          <DiagramBlock>
            <Node icon={Terminal} colorClass="text-indigo-600" />
            <Node icon={MessageCircle} colorClass="text-green-500" />
            <Node icon={Lock} colorClass="text-blue-500" title="API" />
          </DiagramBlock>
          <span className="text-[11px] font-black text-gray-500 tracking-[0.2em] uppercase">Endpoints</span>
        </div>

      </div>
    </section>
  );
}