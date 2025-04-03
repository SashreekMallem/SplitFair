import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Global debug log storage
type LogEntry = {
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'warn';
};

const MAX_LOGS = 100;
let debugLogs: LogEntry[] = [];

// Export logging functions
export const logDebug = (message: string) => {
  debugLogs.unshift({ message, timestamp: new Date(), type: 'info' });
  if (debugLogs.length > MAX_LOGS) debugLogs.pop();
  console.log(`[DEBUG] ${message}`);
};

export const logError = (message: string) => {
  debugLogs.unshift({ message, timestamp: new Date(), type: 'error' });
  if (debugLogs.length > MAX_LOGS) debugLogs.pop();
  console.error(`[ERROR] ${message}`);
};

export const logWarn = (message: string) => {
  debugLogs.unshift({ message, timestamp: new Date(), type: 'warn' });
  if (debugLogs.length > MAX_LOGS) debugLogs.pop();
  console.warn(`[WARN] ${message}`);
};

// Debug overlay component
export const DebugOverlay: React.FC = () => {
  const [visible, setVisible] = useState(__DEV__);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  useEffect(() => {
    // Update logs every second
    const interval = setInterval(() => {
      setLogs([...debugLogs]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!visible) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Debug Console</Text>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setVisible(false)}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text 
            key={index} 
            style={[
              styles.logText, 
              log.type === 'error' && styles.errorText,
              log.type === 'warn' && styles.warnText,
            ]}
          >
            {log.timestamp.toLocaleTimeString()}: {log.message}
          </Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.emptyText}>No logs yet</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    right: 10,
    maxHeight: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 10,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 2,
  },
  logContainer: {
    flex: 1,
  },
  logText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
  },
  errorText: {
    color: '#ff5252',
  },
  warnText: {
    color: '#ffb142',
  },
  emptyText: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
});
