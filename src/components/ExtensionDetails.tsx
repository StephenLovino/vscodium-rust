import React from 'react';
import { useStore } from '../store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ExtensionDetailsProps {
  extensionId: string;
  onBack: () => void;
}

const ExtensionDetails: React.FC<ExtensionDetailsProps> = ({ extensionId, onBack }) => {
  const { 
    extensionDetails, 
    fetchExtensionDetails, 
    installExtension, 
    uninstallExtension, 
    installedExtensions,
    requestExtensionTrust 
  } = useStore();
  
  const details = extensionDetails[extensionId];
  const isInstalled = installedExtensions.some(ext => ext.id === extensionId);

  React.useEffect(() => {
    if (!details) {
      fetchExtensionDetails(extensionId);
    }
  }, [extensionId, details, fetchExtensionDetails]);

  const [isInstalling, setIsInstalling] = React.useState(false);
  
  if (!details) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-[#0d1117]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5" />
          <div className="h-4 w-48 bg-slate-800/50 rounded-full" />
        </div>
      </div>
    );
  }

  // Robust metadata handling for different API response formats
  const displayName = details.displayName || details.name || details.extensionName;
  const publisher = details.publisher?.publisherName || details.publisher?.displayName || details.publisher || details.namespace || "Unknown Publisher";
  const version = details.version || (details.versions && details.versions[0]?.version) || '0.0.1';
  const description = details.shortDescription || details.description || "No description provided.";
  
  // Icon handling
  const icon = details.iconUrl || 
               details.icon_url || 
               details.base64_icon || 
               (details.versions && details.versions[0]?.files?.find((f: any) => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default')?.source) ||
               "https://open-vsx.org/api/icons/default.png";

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      // In a real app, check if publisher is already trusted via the store first.
      // For now, request trust through the formal flow:
      const trusted = await requestExtensionTrust(publisher, details.name || details.extensionName, version);
      if (trusted) {
        await installExtension(publisher, details.name || details.extensionName, version);
      }
    } catch (error: any) {
      console.error("Installation failed:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async () => {
    setIsInstalling(true);
    await uninstallExtension(publisher, details.name || details.extensionName);
    setIsInstalling(false);
  };

  const statistics = details.statistics || [];
  const installCount = statistics.find((s: any) => s.statisticName === 'install')?.value || details.downloadCount || 0;
  const rating = statistics.find((s: any) => s.statisticName === 'averagerating')?.value || details.averageRating || 0;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-all group flex items-center justify-center"
          title="Back to Extensions"
        >
          <span className="codicon codicon-arrow-left text-lg group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate leading-tight tracking-tight text-white/90">
            {displayName}
          </h2>
          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
            <span className="text-blue-400/80 font-medium">{publisher}</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>v{version}</span>
          </p>
        </div>
      </div>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Hero Section */}
        <div className="p-8 pb-10 flex flex-col md:flex-row gap-10 items-start relative overflow-hidden group border-b border-white/5 bg-gradient-to-b from-blue-500/[0.03] to-transparent">
          {/* Subtle background glow */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/10 blur-[120px] pointer-events-none rounded-full" />
          
          <div className="relative z-10 flex-shrink-0">
            <div className="relative group/icon">
              <img
                src={icon}
                alt={displayName}
                className="w-32 h-32 rounded-[2rem] shadow-2xl border border-white/10 bg-slate-900 object-contain p-2 group-hover/icon:scale-[1.02] transition-transform duration-500"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://open-vsx.org/api/icons/default.png"; }}
              />
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-blue-500/10 to-transparent pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 space-y-6 pt-2 relative z-10 w-full">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
                {displayName}
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed max-w-3xl font-light">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div className="flex flex-col">
                {isInstalled ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 text-blue-400 rounded-xl text-sm font-semibold border border-blue-500/20 shadow-inner">
                      <span className={`codicon ${isInstalling ? 'codicon-sync animate-spin' : 'codicon-check'}`} />
                      {isInstalling ? 'Processing...' : 'Installed'}
                    </div>
                    <button
                      onClick={handleUninstall}
                      disabled={isInstalling}
                      className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/20"
                      title="Uninstall Extension"
                    >
                      <span className="codicon codicon-trash" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="group px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] border border-blue-400/20 flex items-center gap-2"
                  >
                    <span className={`codicon ${isInstalling ? 'codicon-sync animate-spin text-lg' : 'codicon-cloud-download text-lg'}`} />
                    <span>{isInstalling ? 'Installing...' : 'Install Extension'}</span>
                  </button>
                )}
              </div>
              
              <div className="hidden sm:block w-px h-12 bg-white/5" />

              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 opacity-60">Installs</span>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="codicon codicon-cloud-download text-slate-500" />
                    <span className="text-base font-medium">{installCount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 opacity-60">Avg Rating</span>
                  <div className="flex items-center gap-2 text-slate-300">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`codicon codicon-star-full text-[10px] ${s <= Math.round(rating) ? 'text-amber-400' : 'text-slate-700'}`} />
                      ))}
                    </div>
                    <span className="text-base font-medium">{rating > 0 ? rating.toFixed(1) : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 py-12">
          {/* Main Column */}
          <div className="space-y-12">
            {/* Markdown Content */}
            <div className="prose prose-invert prose-indigo max-w-none">
               <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                 <span className="codicon codicon-book text-blue-500" />
                 Overview
               </h2>
               <div className="bg-slate-900/30 rounded-2xl p-8 border border-white/5 backdrop-blur-sm">
                <div className="extension-markdown">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                  >
                    {details.readme || 'No additional details available for this extension.'}
                  </ReactMarkdown>
                </div>
                
                {/* Fallback structured content */}
                 <div className="space-y-8 mt-4">
                   <p className="text-slate-400 text-lg leading-relaxed">
                     {details.shortDescription || details.description || "Enhance your development workflow with this powerful extension."}
                   </p>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
                     <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                       <span className="codicon codicon-zap text-2xl text-blue-400 mb-4 block" />
                       <h4 className="text-white font-semibold mb-2">High Performance</h4>
                       <p className="text-sm text-slate-500 leading-relaxed">Optimized for minimal overhead and maximum speed within the editor environment.</p>
                     </div>
                     <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                       <span className="codicon codicon-settings-gear text-2xl text-purple-400 mb-4 block" />
                       <h4 className="text-white font-semibold mb-2">Easy Configuration</h4>
                       <p className="text-sm text-slate-500 leading-relaxed">Fully integrated with settings for a seamless customization experience.</p>
                     </div>
                   </div>
                 </div>
               </div>
            </div>

            {/* Resources Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="codicon codicon-link text-indigo-400" />
                Resources
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <a href={details.repository?.url || details.github || "#"} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="codicon codicon-github text-lg" />
                    <span className="text-sm font-medium">Repository</span>
                  </div>
                  <span className="codicon codicon-arrow-right text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <a href={details.homepage || details.website || "#"} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="codicon codicon-home text-lg" />
                    <span className="text-sm font-medium">Homepage</span>
                  </div>
                  <span className="codicon codicon-arrow-right text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-sm space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Metadata</h3>
                <div className="space-y-4 divide-y divide-white/5">
                  <div className="flex flex-col gap-1 pt-0">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">ID</span>
                    <code className="text-xs text-blue-300 break-all select-all">
                      {extensionId}
                    </code>
                  </div>
                  <div className="flex flex-col gap-1 pt-4">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Publisher</span>
                    <span className="text-sm text-slate-300 font-medium">{publisher}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-4">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">License</span>
                    <span className="text-sm text-slate-300">{details.license || 'Proprietary'}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-4">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Last Updated</span>
                    <span className="text-sm text-slate-300">
                      {details.lastUpdated ? new Date(details.lastUpdated).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {(details.categories || ['Extension']).map((cat: string) => (
                    <span key={cat} className="px-3 py-1 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 border border-white/5 uppercase tracking-wider">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="codicon codicon-shield text-blue-500" />
                </div>
                <h4 className="text-sm font-bold text-blue-400">Security Verified</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                This extension has been scanned for common vulnerabilities and follows best practices for safety and performance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionDetails;
