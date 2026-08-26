package user

import "testing"

func TestBuildSubscriptionLinksAddsKeyUsernameFragment(t *testing.T) {
	links, err := BuildSubscriptionLinks(
		SubscriptionLinkRequest{
			Username:      "alice",
			CredentialKey: "credential-key",
			Preferred:     subscriptionTypeKeyUsername,
			Salt:          "fixed-salt",
		},
		SubscriptionSettings{},
		AdminLinkSettings{},
		"subscription-secret",
	)
	if err != nil {
		t.Fatal(err)
	}
	want := "/sub/credential-key#alice"
	got, ok := links.Links.Get(subscriptionTypeKeyUsername)
	if !ok || got != want || links.Primary != want {
		t.Fatalf("key-username link = %q, primary = %q; want %q", got, links.Primary, want)
	}
}
