import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../config/supabase';
import { logDebug, logError } from '../utils/DebugHelper';
import { useAuth } from '../context/AuthContext';

/**
 * A diagnostic component to test specific database queries
 * and pinpoint where the policy recursion is happening
 */
const PolicyDiagnostic: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<string[]>([]);
  
  const addResult = (message: string) => {
    setResults(prev => [...prev, message]);
  };
  
  const clearResults = () => {
    setResults([]);
  };
  
  const testHomeMembers = async () => {
    if (!user) {
      addResult('No user logged in');
      return;
    }
    
    try {
      addResult('Testing home_members direct query...');
      
      // This is the query that's causing infinite recursion
      const { data, error } = await supabase
        .from('home_members')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        addResult(`ERROR: ${error.message}`);
        logError(`Policy recursion error: ${error.message}`);
      } else {
        addResult(`SUCCESS: Retrieved home member: ${data.id}`);
      }
    } catch (error: any) {
      addResult(`EXCEPTION: ${error.message}`);
    }
  };
  
  const testHomeMembersMinimal = async () => {
    if (!user) {
      addResult('No user logged in');
      return;
    }
    
    try {
      addResult('Testing home_members with minimal columns...');
      
      // Try only selecting specific columns
      const { data, error } = await supabase
        .from('home_members')
        .select('id, user_id, home_id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (error) {
        addResult(`ERROR: ${error.message}`);
        logError(`Even minimal query failed: ${error.message}`);
      } else {
        addResult(`SUCCESS: Retrieved ${data.length} results`);
        addResult(JSON.stringify(data[0], null, 2));
      }
    } catch (error: any) {
      addResult(`EXCEPTION: ${error.message}`);
    }
  };
  
  const testHomesTable = async () => {
    if (!user) {
      addResult('No user logged in');
      return;
    }
    
    try {
      addResult('Testing homes table access...');
      
      // Try to get homes where user is creator
      const { data, error } = await supabase
        .from('homes')
        .select('*')
        .eq('created_by', user.id)
        .limit(1);
      
      if (error) {
        addResult(`ERROR: ${error.message}`);
        logError(`Homes table access failed: ${error.message}`);
      } else {
        addResult(`SUCCESS: Retrieved ${data.length} homes`);
      }
    } catch (error: any) {
      addResult(`EXCEPTION: ${error.message}`);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Policy Diagnostic Tool</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testHomeMembers}>
          <Text style={styles.buttonText}>Test home_members</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testHomeMembersMinimal}>
          <Text style={styles.buttonText}>Test Minimal Query</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testHomesTable}>
          <Text style={styles.buttonText}>Test homes Table</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Results:</Text>
        {results.length === 0 ? (
          <Text style={styles.noResults}>Run a test to see results</Text>
        ) : (
          results.map((result, index) => (
            <Text key={index} style={styles.resultText}>
              {result}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#546DE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    width: '48%',
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#E74C3C',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noResults: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  resultText: {
    marginVertical: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});

export default PolicyDiagnostic;
