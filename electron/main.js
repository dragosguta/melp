// Modules to control application life and create native browser window
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

const { spawn } = require('child_process');
const { app, BrowserWindow, Tray, Menu, MenuItem } = require('electron');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let tray;
let events;

let calReader;
let calWatcher;

let timer;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600, show:false})

  // and load the index.html of the app.
  // mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  createTray();
  createMenu();
  createWatcher();

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

function createTray() {
  tray = new Tray(path.join(__dirname, './images', '16x16.png'));
  tray.setToolTip("Meeting helper");
}

function createMenu() {
  const menu = new Menu();

  menu.append(new MenuItem({ label: 'Refresh', click: getEvents }));
  menu.append(new MenuItem({ type: 'separator' }));
  menu.append(new MenuItem({ label: 'Quit', click: () => app.quit() }));

  tray.setContextMenu(menu);
}

function getEvents() {
  calReader = spawn(path.join(__dirname, '../swift/.build/debug/melp'), ['-c', 'DG']);
  calReader.stdout.on('data', data => sortEvents(data.toString()));
}

function sortEvents(jsonList) {
  try {
    events = JSON.parse(jsonList);
    const currentTime = new Date();
    const eventDates = [];

    for (let key in events) {
      eventDates.push(new Date(events[key]));
    }

    const date = nextDate(currentTime, eventDates);
    if (date) {
      clearInterval(timer);
      startTimer(date.getTime());
    } else {
      console.log('ERROR: Unable to get the next date.');
    }
  } catch(e) { console.log(e); }
}

function nextDate(startDate, dates) {
  let startTime = +startDate;
  let nearestDate, nearestDiff = Infinity;
  for(let i = 0, n = dates.length;  i < n;  ++i ) {
      let diff = +dates[i] - startTime;
      if( diff > 0  &&  diff < nearestDiff ) {
          nearestDiff = diff;
          nearestDate = dates[i];
      }
  }
  return nearestDate;
}

function startTimer(countdownDatetime) {
  timer = setInterval(() => {
    const now = new Date().getTime();
    const distance = countdownDatetime - now;

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    tray.setTitle(`${_.padStart(hours, 2, '0')}:${_.padStart(minutes, 2, '0')}:${_.padStart(seconds, 2, '0')}`);

    if (distance < 0) {
      clearInterval(timer);
      tray.setTitle('');
      console.log('INFO: Timer finished.');
      getEvents();
    }
  }, 1000);
}

function createWatcher() {
  calWatcher = spawn(path.join(__dirname, '../swift/.build/debug/melp'), ['-l', '-c', 'DG']);
  calWatcher.stdout.on('data', data => sortEvents(data.toString()));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
