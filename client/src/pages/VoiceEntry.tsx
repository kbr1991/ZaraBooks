import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Mic,
  MicOff,
  Send,
  History,
  CheckCircle,
  Loader2,
  MessageSquare,
  Lightbulb,
  Volume2,
  Languages,
  Receipt,
  FileText,
  Wallet,
  BarChart3,
  Trash2,
} from 'lucide-react';

interface VoiceTranscription {
  id: string;
  transcription: string;
  transcriptionConfidence?: string;
  language?: string;
  parsedIntent?: string;
  parsedEntities?: {
    amount?: number;
    description?: string;
    customer?: string;
    vendor?: string;
    date?: string;
    category?: string;
  };
  actionTaken?: string;
  createdEntryId?: string;
  createdAt: string;
}

interface VoiceCommand {
  intent: string;
  description: string;
  examples: string[];
  requiredEntities: string[];
  optionalEntities: string[];
}

interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export default function VoiceEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Fetch history
  const { data: history, isLoading: historyLoading } = useQuery<VoiceTranscription[]>({
    queryKey: ['/api/voice/history'],
  });

  // Fetch available commands
  const { data: commands } = useQuery<VoiceCommand[]>({
    queryKey: ['/api/voice/commands'],
  });

  // Fetch supported languages
  const { data: languages } = useQuery<{
    supported: Array<{ code: string; name: string; nameNative?: string }>;
    default: string;
  }>({
    queryKey: ['/api/voice/settings/languages'],
  });

  // Process text mutation
  const processTextMutation = useMutation({
    mutationFn: async (data: { text: string; language: string }) => {
      const res = await fetch('/api/voice/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresConfirmation && data.parsed.intent !== 'unknown') {
        setTranscriptionId(data.transcription.id);
        setParsedCommand(data.parsed);
        setShowConfirmDialog(true);
      } else {
        toast({
          title: 'Could not understand command',
          description: 'Please try rephrasing or use one of the example commands',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/voice/history'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Processing failed', description: error.message, variant: 'destructive' });
    },
  });

  // Execute command mutation
  const executeMutation = useMutation({
    mutationFn: async (data: { transcriptionId: string | null; intent: string; entities: Record<string, any> }) => {
      const res = await fetch('/api/voice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/history'] });
      toast({
        title: 'Command executed',
        description: data.message,
      });
      setShowConfirmDialog(false);
      setParsedCommand(null);
      setTranscriptionId(null);
      setTextInput('');
    },
    onError: (error: Error) => {
      toast({ title: 'Execution failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete history item mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voice/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/history'] });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In production, would upload to server for transcription
        toast({ title: 'Recording stopped', description: 'Audio captured (transcription not yet implemented)' });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: 'Recording started', description: 'Speak your command...' });
    } catch (error) {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use voice commands',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      processTextMutation.mutate({ text: textInput, language });
    }
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'create_expense':
        return <Receipt className="w-5 h-5 text-red-600" />;
      case 'create_invoice':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'check_balance':
        return <Wallet className="w-5 h-5 text-blue-600" />;
      case 'get_report':
        return <BarChart3 className="w-5 h-5 text-purple-600" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case 'create_expense':
        return 'Create Expense';
      case 'create_invoice':
        return 'Create Invoice';
      case 'check_balance':
        return 'Check Balance';
      case 'get_report':
        return 'Get Report';
      case 'record_payment':
        return 'Record Payment';
      default:
        return intent;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Voice Entry</h1>
          <p className="text-gray-500">Create entries using voice or natural language commands</p>
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[180px]">
            <Languages className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages?.supported.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name} {lang.nameNative && `(${lang.nameNative})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Input Card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-6">
            {/* Voice Recording Button */}
            <div className="relative">
              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                className={`w-24 h-24 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <MicOff className="w-10 h-10" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </Button>
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping" />
              )}
            </div>
            <p className="text-muted-foreground">
              {isRecording ? 'Click to stop recording' : 'Click to start voice recording'}
            </p>

            {/* Text Input Alternative */}
            <div className="w-full max-w-xl">
              <div className="flex gap-2">
                <Input
                  placeholder="Or type your command here... e.g., 'Add expense of 500 rupees for tea'"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                  className="flex-1"
                />
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || processTextMutation.isPending}
                >
                  {processTextMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Example Commands
          </CardTitle>
          <CardDescription>Try saying or typing these commands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {commands?.map((command) => (
              <div key={command.intent} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getIntentIcon(command.intent)}
                  <h4 className="font-medium">{getIntentLabel(command.intent)}</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{command.description}</p>
                <div className="space-y-1">
                  {command.examples.slice(0, 2).map((example, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-1 text-xs"
                      onClick={() => setTextInput(example)}
                    >
                      <Volume2 className="w-3 h-3 mr-2 flex-shrink-0" />
                      <span className="truncate">{example}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4" />
              <p>No voice commands yet</p>
              <p className="text-sm">Try recording or typing a command above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="p-2 bg-muted rounded-lg">
                    {item.parsedIntent ? getIntentIcon(item.parsedIntent) : <MessageSquare className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.transcription}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {item.parsedIntent && (
                        <Badge variant="outline">{getIntentLabel(item.parsedIntent)}</Badge>
                      )}
                      {item.parsedEntities?.amount && (
                        <Badge variant="secondary">{formatCurrency(item.parsedEntities.amount)}</Badge>
                      )}
                      {item.actionTaken && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {item.actionTaken}
                        </Badge>
                      )}
                      {item.transcriptionConfidence && (
                        <span className="text-xs text-muted-foreground">
                          {parseFloat(item.transcriptionConfidence).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {parsedCommand && getIntentIcon(parsedCommand.intent)}
              Confirm Action
            </DialogTitle>
            <DialogDescription>
              Review the extracted information before creating the entry
            </DialogDescription>
          </DialogHeader>
          {parsedCommand && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Badge>{getIntentLabel(parsedCommand.intent)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {(parsedCommand.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <div className="space-y-2">
                  {parsedCommand.entities.amount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{formatCurrency(parsedCommand.entities.amount)}</span>
                    </div>
                  )}
                  {parsedCommand.entities.description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="font-medium">{parsedCommand.entities.description}</span>
                    </div>
                  )}
                  {parsedCommand.entities.customer && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="font-medium">{parsedCommand.entities.customer}</span>
                    </div>
                  )}
                  {parsedCommand.entities.vendor && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="font-medium">{parsedCommand.entities.vendor}</span>
                    </div>
                  )}
                  {parsedCommand.entities.date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{parsedCommand.entities.date}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (parsedCommand) {
                  executeMutation.mutate({
                    transcriptionId,
                    intent: parsedCommand.intent,
                    entities: parsedCommand.entities,
                  });
                }
              }}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
