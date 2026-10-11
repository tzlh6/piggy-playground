// Give the inner program the pig icon and Chinese version info (no Wine needed).
const fs=require('fs'),path=require('path');
exports.default=async function(context){
 if(context.electronPlatformName!=='win32')return;
 const ResEdit=await import('resedit'),PE=await import('pe-library');
 const exePath=path.join(context.appOutDir,context.packager.appInfo.productFilename+'.exe');
 const exe=PE.NtExecutable.from(fs.readFileSync(exePath),{ignoreCert:true}),res=PE.NtExecutableResource.from(exe);
 const ico=ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname,'..','app','assets','pig.ico')));
 ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries,ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0].id,1033,ico.icons.map(i=>i.data));
 const vi=ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0],v=context.packager.appInfo.version.split('.').map(Number);
 vi.setFileVersion(v[0],v[1],v[2],0,1033);vi.setProductVersion(v[0],v[1],v[2],0,1033);
 vi.setStringValues({lang:1033,codepage:1200},{FileDescription:'猪猪游乐场',ProductName:'猪猪游乐场',CompanyName:'Piggy Playground',InternalName:'猪猪游乐场',OriginalFilename:'猪猪游乐场.exe',LegalCopyright:'个人自用离线小游戏',FileVersion:context.packager.appInfo.version,ProductVersion:context.packager.appInfo.version});
 vi.outputToResourceEntries(res.entries);res.outputResource(exe);fs.writeFileSync(exePath,Buffer.from(exe.generate()));
};
