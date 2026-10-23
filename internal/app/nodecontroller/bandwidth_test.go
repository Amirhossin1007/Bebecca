package nodecontroller

import "testing"

func TestSumNodeBandwidthMapsDownloadToIncomingAndUploadToOutgoing(t *testing.T) {
	incoming, outgoing := sumNodeBandwidth([]NetInfo{
		{UploadSpeed: 10, DownloadSpeed: 20},
		{UploadSpeed: 1, DownloadSpeed: 2},
	})
	if incoming != 22 || outgoing != 11 {
		t.Fatalf("incoming=%d outgoing=%d, want 22 and 11", incoming, outgoing)
	}
}
