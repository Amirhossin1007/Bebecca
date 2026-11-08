package nodecontroller

import (
	"context"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func (c Controller) IssueCertificate(ctx context.Context, nodeID int64, identifier, email string) ([]byte, []byte, error) {
	client, _, err := c.dial(ctx, nodeID)
	if err != nil {
		return nil, nil, friendlyNodeError("issue certificate", nodeID, err)
	}
	res, err := client.Runtime().IssueCertificate(ctx, &nodev1.CertificateIssueRequest{
		Identifier: identifier,
		Email:      email,
	})
	if err != nil {
		return nil, nil, friendlyNodeError("issue certificate", nodeID, err)
	}
	return []byte(res.GetFullchainPem()), []byte(res.GetPrivateKeyPem()), nil
}
