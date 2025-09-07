'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Database, Zap, Globe } from 'lucide-react';
import Link from 'next/link';
import { ApiConnectionStatus } from '@/components/ApiConnectionStatus';

interface EndpointTest {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  status: 'pending' | 'success' | 'error';
  response?: any;
  error?: string;
  responseTime?: number;
}

export default function ApiTestPage() {
  const [tests, setTests] = useState<EndpointTest[]>([
    {
      name: 'Health Check',
      url: 'http://localhost:4000/health',
      method: 'GET',
      status: 'pending',
    },
    {
      name: 'API Health Check',
      url: 'http://localhost:4000/api/v1/health',
      method: 'GET',
      status: 'pending',
    },
  ]);

  const runTest = async (test: EndpointTest, index: number) => {
    const startTime = Date.now();

    setTests((prev) =>
      prev.map((t, i) => (i === index ? { ...t, status: 'pending' as const } : t)),
    );

    try {
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      setTests((prev) =>
        prev.map((t, i) =>
          i === index
            ? {
                ...t,
                status: response.ok ? ('success' as const) : ('error' as const),
                response: data,
                responseTime,
                error: response.ok ? undefined : `HTTP ${response.status}`,
              }
            : t,
        ),
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      setTests((prev) =>
        prev.map((t, i) =>
          i === index
            ? {
                ...t,
                status: 'error' as const,
                responseTime,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : t,
        ),
      );
    }
  };

  const runAllTests = async () => {
    for (let i = 0; i < tests.length; i++) {
      await runTest(tests[i], i);
      // Small delay between tests
      if (i < tests.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusBadge = (status: EndpointTest['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
            ✓ Success
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800">
            ✗ Error
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
            ⌛ Testing...
          </span>
        );
    }
  };

  const successCount = tests.filter((t) => t.status === 'success').length;
  const totalTests = tests.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <Server className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">API Integration Test</h1>
              <p className="text-muted-foreground">Testing frontend-backend connectivity</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span>Frontend: http://localhost:3000</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              <span>Backend: http://localhost:4000</span>
            </div>
          </div>
        </div>

        {/* Connection Status Overview */}
        <div className="grid gap-6 mb-8">
          <ApiConnectionStatus className="w-full" />

          <div className="rounded-lg border p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-semibold">Test Results</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {successCount}/{totalTests} tests passing
                </span>
                <button
                  onClick={runAllTests}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                >
                  Run All Tests
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {tests.map((test, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{test.name}</h3>
                      {getStatusBadge(test.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono">{test.method}</span>
                      {test.responseTime && <span>{test.responseTime}ms</span>}
                      <button
                        onClick={() => runTest(test, index)}
                        className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-xs"
                      >
                        Retest
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-2 font-mono">{test.url}</div>

                  {test.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                      <strong>Error:</strong> {test.error}
                    </div>
                  )}

                  {test.response && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="text-sm text-green-800 font-medium mb-2">Response:</div>
                      <pre className="text-xs text-green-700 overflow-x-auto">
                        {JSON.stringify(test.response, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integration Summary */}
        <div className="rounded-lg border p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Integration Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Frontend Status:</span>
              <span className="text-green-600 font-medium">✓ Running (Next.js)</span>
            </div>
            <div className="flex justify-between">
              <span>Backend Status:</span>
              <span
                className={
                  successCount > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                }
              >
                {successCount > 0 ? '✓ Connected (Express.js)' : '✗ Not Connected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>API Endpoints:</span>
              <span className="font-medium">
                {successCount}/{totalTests} responding
              </span>
            </div>
            <div className="flex justify-between">
              <span>CORS Configuration:</span>
              <span
                className={
                  successCount > 0 ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'
                }
              >
                {successCount > 0 ? '✓ Configured' : '⚠ Check CORS settings'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
