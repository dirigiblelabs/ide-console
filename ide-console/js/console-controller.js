/*
 * Copyright (c) 2010-2021 SAP and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *   SAP - initial API and implementation
 */
const consoleView = angular.module('console', ['ideUI', 'ideView']);

consoleView.config(["messageHubProvider", function (messageHubProvider) {
    messageHubProvider.eventIdPrefix = 'console-view';
}]);

consoleView.controller('ConsoleController', ['$scope', 'messageHub', function ($scope, messageHub) {
    $scope.allLogs = [];
    $scope.logs = [];
    $scope.search = { text: '' };
    $scope.autoScroll = true;

    let lastKnownScrollPosition = -1;
    let isScrolling = false;
    let logContentEl = $('#logContent');

    $scope.logLevels = {
        'LOG': { enabled: true },
        'INFO': { name: 'Info', enabled: true },
        'WARN': { name: 'Warning', enabled: true },
        'ERROR': { name: 'Error', enabled: true },
        'DEBUG': { name: 'Debug', enabled: true },
        'TRACE': { name: 'Trace', enabled: true }
    };

    $scope.logLevelStatuses = {
        'INFO': 'fd-object-status--positive',
        'WARN': 'fd-object-status--critical',
        'ERROR': 'fd-object-status--negative'
    }

    $scope.clearLog = function () {
        $scope.logs = [];
        $scope.allLogs = [];
        $scope.autoScroll = true;
        lastKnownScrollPosition = -1;
    };

    $scope.search = function () {
        $scope.logs = $scope.allLogs.filter(e => isLogLevelEnabled(e) && isLogContainsSearchText(e));
    };

    $scope.selectLogLevel = function () {
        $scope.logs = $scope.allLogs.filter(e => isLogLevelEnabled(e) && isLogContainsSearchText(e));
    };

    $scope.toggleLogInfoLevel = function (logLevel, e) {
        $scope.logLevels[logLevel].enabled = !$scope.logLevels[logLevel].enabled;
        $scope.selectLogLevel();

        e.preventDefault();
    }

    $scope.getLogLevelLabel = function () {
        let logType;
        let enabledLogsCount = 0;
        const logLevels = Object.values($scope.logLevels).filter(x => x.name);
        for (let logLevel of logLevels) {
            if (logLevel.enabled) {
                logType = logLevel;
                enabledLogsCount++;
            }
        }
        return enabledLogsCount === 0 ? 'Hide all' :
            enabledLogsCount === 1 ? `${logType.name} only` :
                enabledLogsCount === logLevels.length ? 'All levels' : 'Custom levels';
    }

    function isLogContainsSearchText(record) {
        if ($scope.search.text) {
            return record.message.toLowerCase().includes($scope.search.text.toLowerCase());
        }
        return true;
    }

    function isLogLevelEnabled(record) {
        const logLevel = $scope.logLevels[record.level];
        return logLevel && logLevel.enabled;
    }

    function connectToLog() {
        let logSocket = null;
        try {
            logSocket = new WebSocket(
                ((location.protocol === 'https:') ? "wss://" : "ws://")
                + window.location.host
                + window.location.pathname.substr(0, window.location.pathname.indexOf('/services/'))
                + "/websockets/v4/ide/console");
        } catch (e) {
            let record = {
                message: e.message,
                level: "ERROR",
                date: new Date().toISOString()
            };
            consoleLogMessage(record);
        }
        if (logSocket) {
            logSocket.onmessage = function (message) {
                let record = JSON.parse(message.data);
                record.date = new Date(record.timestamp).toISOString();

                consoleLogMessage(record);

                scrollToBottom();

                if (record.level === 'ERROR' || record.level === 'WARN') {
                    messageHub.setStatusError(record.message);
                }
            };

            logSocket.onerror = function (error) {
                let record = {
                    message: "Connection problem! Check security roles assignments.",
                    level: "ERROR",
                    date: new Date().toISOString()
                };
                consoleLogMessage(record);
                messageHub.setStatusError(record.message);
            };
        }
    }

    function consoleLogMessage(record) {
        $scope.allLogs.push(record);
        $scope.selectLogLevel();
        $scope.$apply();
    }

    function isScrolledToBottom() {
        let scrollHeight = logContentEl.get(0).scrollHeight;
        let scrollPosition = logContentEl.height() + logContentEl.scrollTop();
        return (Math.round(((scrollHeight - scrollPosition) / scrollHeight) * 100) / 100 === 0);
    }

    function scrollToBottom() {
        if ($scope.autoScroll) {

            if (!isScrolling && !isScrolledToBottom()) {
                isScrolling = true;
                logContentEl.animate({
                    scrollTop: logContentEl.get(0).scrollHeight,
                }, {
                    always: () => {
                        isScrolling = false;
                        scrollToBottom();
                    }
                });
            }
        }
    }

    messageHub.onPublish(function () {
        $scope.$apply();
    });

    messageHub.onUnpublish(function () {
        $scope.$apply();
    });

    logContentEl.on('scroll', function () {
        if (isScrolling) return;

        let scrollPosition = logContentEl.height() + logContentEl.scrollTop();
        if (lastKnownScrollPosition !== -1) {
            if ($scope.autoScroll) {
                if (scrollPosition < lastKnownScrollPosition) { //scroll up
                    $scope.autoScroll = false
                    $scope.$apply();
                }
            } else {
                if (scrollPosition > lastKnownScrollPosition && isScrolledToBottom()) {
                    $scope.autoScroll = true
                    $scope.$apply();
                }
            }
        }

        lastKnownScrollPosition = scrollPosition;
    });

    connectToLog();
}]);
