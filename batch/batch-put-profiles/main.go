package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/guregu/dynamo"
)

var region = "ap-northeast-1"
var sourceTableName = "profiles"
var endpoint = ""

func main() {
	db := dynamo.New(session.New(), &aws.Config{
		Region: aws.String(region),
	})
	sourceTable := db.Table(sourceTableName)
	tableIter := sourceTable.Scan().Iter()

	client := &http.Client{}

	var item map[string]interface{}
	counter := 0
	for tableIter.Next(&item) {
		counter++
		if counter%100 == 0 {
			fmt.Printf("%+v items...\n", counter)
		}

		jsonRep, err := json.Marshal(item)
		if err != nil {
			fmt.Printf("skipping %+v\n", item)
			continue
		}

		body := bytes.NewBuffer(jsonRep)
		req, err := http.NewRequest("PUT", endpoint+item["userId"].(string), body)
		if err != nil {
			fmt.Printf("skipping %+v\n", item)
			continue
		}
		req.Header.Add("Authorization", "Bearer "+os.Getenv("auth_token"))

		res, err := client.Do(req)
		if err != nil {
			fmt.Printf("skipping %+v\n", item)
			continue
		}
		if res.StatusCode != 200 {
			fmt.Printf("skipping %+v\n", item)
			continue
		}
	}

	fmt.Printf("%+v items processed successfully.\n", counter)
}
