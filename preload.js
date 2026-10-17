'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('api',{
 cancelStorage:()=>ipcRenderer.invoke('storage-cancel'),onStorageProgress:fn=>ipcRenderer.on('storage-progress',(_e,value)=>fn(value)),
 getShutdownState:()=>ipcRenderer.invoke('shutdown-state'),scheduleShutdown:minutes=>ipcRenderer.invoke('shutdown-schedule',minutes),cancelShutdown:()=>ipcRenderer.invoke('shutdown-cancel'),onShutdownState:fn=>ipcRenderer.on('shutdown-state',(_e,value)=>fn(value)),
 cancelUpdate:()=>ipcRenderer.invoke('updates-cancel'),
 getUsername:()=>ipcRenderer.invoke('get-username'),startLauncher:mode=>ipcRenderer.invoke('start-launcher',mode),stopLauncher:()=>ipcRenderer.invoke('stop-launcher'),
 tool:(action,payload)=>ipcRenderer.invoke('tool',action,payload),
 onLauncherProgress:fn=>ipcRenderer.on('launcher-progress',(_e,value)=>fn(value)),onLauncherState:fn=>ipcRenderer.on('launcher-state',(_e,value)=>fn(value)),
 minimizeWindow:()=>ipcRenderer.send('window-minimize'),maximizeWindow:()=>ipcRenderer.send('window-maximize'),closeApp:()=>ipcRenderer.send('close-app'),
 getUpdateState:()=>ipcRenderer.invoke('updates-state'),checkUpdates:()=>ipcRenderer.invoke('updates-check'),downloadUpdate:()=>ipcRenderer.invoke('updates-download'),installUpdate:()=>ipcRenderer.invoke('updates-install'),onUpdateState:fn=>ipcRenderer.on('updates-event',(_e,value)=>fn(value))
});
